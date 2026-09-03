async function checkRelease() {
const rawTarget = process.argv[2] ?? process.env.RELEASE_URL;

if (!rawTarget) {
  console.error('Usage: npm run release:check -- https://example.com');
  return 2;
}

const requestedUrl = new URL(rawTarget);
const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const failures = [];

if (requestedUrl.protocol !== 'https:' && !localHosts.has(requestedUrl.hostname)) {
  failures.push('non-local release URLs must use HTTPS');
}

let response;
try {
  response = await fetch(requestedUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
    headers: { accept: 'text/html' },
  });
} catch (error) {
  console.error(`Release check could not reach ${requestedUrl}: ${error.message}`);
  return 1;
}

const finalUrl = new URL(response.url);
const contentType = response.headers.get('content-type') ?? '';
const originAgentCluster = response.headers.get('origin-agent-cluster');
const permissionsPolicy = response.headers.get('permissions-policy') ?? '';
const body = await response.text();

if (response.status !== 200) failures.push(`expected HTTP 200, received ${response.status}`);
if (finalUrl.origin !== requestedUrl.origin) failures.push(`redirected off-origin to ${finalUrl.origin}`);
if (!contentType.toLowerCase().includes('text/html')) {
  failures.push(`expected text/html, received ${contentType || 'no content type'}`);
}
if (originAgentCluster !== '?1') {
  failures.push(`Origin-Agent-Cluster must be ?1, received ${originAgentCluster ?? 'missing'}`);
}
if (!/(^|,)\s*tools\s*=\s*\(\s*self\s*\)/i.test(permissionsPolicy)) {
  failures.push(`Permissions-Policy is missing tools=(self): ${permissionsPolicy || 'missing'}`);
}
if (!/<html(?:\s|>)/i.test(body)) failures.push('response is not an HTML document');

const marker = process.env.RELEASE_MARKER;
if (marker && !body.includes(marker)) failures.push(`response is missing RELEASE_MARKER: ${marker}`);

if (failures.length) {
  console.error(JSON.stringify({
    ok: false,
    requestedUrl: requestedUrl.toString(),
    finalUrl: finalUrl.toString(),
    failures,
  }, null, 2));
  return 1;
}

console.log(JSON.stringify({
  ok: true,
  url: finalUrl.toString(),
  status: response.status,
  originAgentCluster,
  permissionsPolicy,
}, null, 2));
return 0;
}

process.exitCode = await checkRelease();
