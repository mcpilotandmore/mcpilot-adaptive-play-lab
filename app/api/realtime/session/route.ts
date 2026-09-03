import {
  createFixedWindowLimiter,
  createRealtimeSessionConfig,
  sameRequestOrigin,
  validateRealtimeSdp,
} from '../../../realtime-session.mjs';

export const dynamic = 'force-dynamic';

const limiter = createFixedWindowLimiter();
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

function jsonError(status: number, code: string, extraHeaders: Record<string, string> = {}) {
  return Response.json(
    { error: code },
    { status, headers: { ...NO_STORE_HEADERS, ...extraHeaders } },
  );
}

async function safetyIdentifier(request: Request) {
  const address = request.headers.get('cf-connecting-ip');
  if (!address) return null;
  const bytes = new TextEncoder().encode(`second-player:${address}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  if (!sameRequestOrigin(request.url, request.headers.get('origin'))) {
    return jsonError(403, 'origin_not_allowed');
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 32_000) {
    return jsonError(413, 'request_too_large');
  }

  const body = await request.text();
  const validation = validateRealtimeSdp(request.headers.get('content-type'), body);
  if (!validation.ok) return jsonError(validation.status ?? 400, validation.code ?? 'invalid_request');

  const rateKey = request.headers.get('cf-connecting-ip') ?? 'local-preview';
  const rate = limiter.take(rateKey);
  if (!rate.allowed) {
    return jsonError(429, 'voice_session_limit', {
      'Retry-After': String(rate.retryAfterSeconds),
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return jsonError(503, 'voice_not_configured');

  const form = new FormData();
  form.set('sdp', body);
  form.set('session', JSON.stringify(createRealtimeSessionConfig()));

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  const identifier = await safetyIdentifier(request);
  if (identifier) headers['OpenAI-Safety-Identifier'] = identifier;

  try {
    const upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers,
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    const answer = await upstream.text();
    if (!upstream.ok) {
      console.error('Realtime session initialization failed', { status: upstream.status });
      const status = upstream.status === 429 ? 429 : 502;
      const code = upstream.status === 429 ? 'openai_rate_limited' : 'voice_connection_failed';
      return jsonError(status, code, upstream.status === 429 ? { 'Retry-After': '30' } : {});
    }

    return new Response(answer, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        'Content-Type': 'application/sdp',
      },
    });
  } catch (error) {
    console.error('Realtime session initialization unavailable', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return jsonError(504, 'voice_connection_timeout');
  }
}
