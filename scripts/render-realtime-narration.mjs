import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(root, 'submission', 'narration.realtime.json');
const outputRoot = resolve(root, 'outputs', 'voice', 'realtime');
const finalRoot = resolve(root, 'outputs', 'voice');
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) throw new Error('OPENAI_API_KEY is not available. Run with node --env-file=.env.local.');

const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (!Array.isArray(config.segments) || config.segments.length === 0) throw new Error('Narration segments are missing.');
if (!Number.isFinite(config.runtimeSeconds) || config.runtimeSeconds >= 180) throw new Error('Narration runtime must stay under three minutes.');

let previousEnd = 0;
for (const segment of config.segments) {
  if (!segment.id || !segment.text || segment.start < previousEnd || segment.end <= segment.start || segment.end > config.runtimeSeconds) {
    throw new Error(`Invalid narration timing for ${segment.id || 'unknown segment'}.`);
  }
  previousEnd = segment.end;
}

mkdirSync(outputRoot, { recursive: true });
mkdirSync(finalRoot, { recursive: true });

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 180_000 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
};

const audioDuration = (path) => Number(run('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path,
]));

const socket = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(config.model)}`, {
  headers: { Authorization: `Bearer ${apiKey}` },
});

const queuedEvents = [];
const listeners = new Set();
socket.on('message', (raw) => {
  let event;
  try { event = JSON.parse(raw.toString()); } catch { return; }
  queuedEvents.push(event);
  for (const listener of listeners) listener(event);
});

const waitFor = (predicate, timeoutMs = 120_000) => new Promise((resolvePromise, rejectPromise) => {
  const existingIndex = queuedEvents.findIndex(predicate);
  if (existingIndex >= 0) {
    resolvePromise(queuedEvents.splice(existingIndex, 1)[0]);
    return;
  }
  const timer = setTimeout(() => {
    listeners.delete(onEvent);
    rejectPromise(new Error('Realtime event wait timed out.'));
  }, timeoutMs);
  const onEvent = (event) => {
    if (!predicate(event)) return;
    clearTimeout(timer);
    listeners.delete(onEvent);
    const index = queuedEvents.indexOf(event);
    if (index >= 0) queuedEvents.splice(index, 1);
    resolvePromise(event);
  };
  listeners.add(onEvent);
});

await new Promise((resolvePromise, rejectPromise) => {
  socket.once('open', resolvePromise);
  socket.once('error', rejectPromise);
});

const created = await waitFor((event) => event.type === 'session.created' || event.type === 'error');
if (created.type === 'error') throw new Error(created.error?.message || 'Realtime session creation failed.');

socket.send(JSON.stringify({
  type: 'session.update',
  session: {
    type: 'realtime',
    output_modalities: ['audio'],
    instructions: config.style,
    audio: {
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: config.voice,
        speed: 1,
      },
    },
    tools: [],
    tool_choice: 'none',
  },
}));

const updated = await waitFor((event) => event.type === 'session.updated' || event.type === 'error');
if (updated.type === 'error') throw new Error(updated.error?.message || 'Realtime session update failed.');

const manifest = [];

for (const segment of config.segments) {
  const audioChunks = [];
  let transcript = '';
  const eventId = `mcpilot-narration-${segment.id}`;
  const responseDone = new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      listeners.delete(onEvent);
      rejectPromise(new Error(`Realtime response timed out for ${segment.id}.`));
    }, 120_000);
    const onEvent = (event) => {
      if (event.type === 'response.output_audio.delta' && event.delta) {
        audioChunks.push(Buffer.from(event.delta, 'base64'));
      } else if (event.type === 'response.output_audio_transcript.delta' && event.delta) {
        transcript += event.delta;
      } else if (event.type === 'error') {
        clearTimeout(timer);
        listeners.delete(onEvent);
        rejectPromise(new Error(event.error?.message || `Realtime error for ${segment.id}.`));
      } else if (event.type === 'response.done') {
        clearTimeout(timer);
        listeners.delete(onEvent);
        if (event.response?.status !== 'completed') {
          rejectPromise(new Error(`Realtime response was ${event.response?.status || 'not completed'} for ${segment.id}.`));
        } else {
          resolvePromise();
        }
      }
    };
    listeners.add(onEvent);
  });

  socket.send(JSON.stringify({
    type: 'response.create',
    event_id: eventId,
    response: {
      conversation: 'none',
      output_modalities: ['audio'],
      instructions: `${config.style}\nRead the supplied narration exactly. Add no words.`,
      input: [{
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: segment.text }],
      }],
      metadata: { segment_id: segment.id },
      tools: [],
      tool_choice: 'none',
    },
  }));

  await responseDone;
  if (audioChunks.length === 0) throw new Error(`Realtime returned no audio for ${segment.id}.`);

  const pcmPath = resolve(outputRoot, `${segment.id}.pcm`);
  const rawWavPath = resolve(outputRoot, `${segment.id}-raw.wav`);
  const fittedWavPath = resolve(outputRoot, `${segment.id}.wav`);
  writeFileSync(pcmPath, Buffer.concat(audioChunks));
  run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcmPath,
    '-af', 'highpass=f=70,lowpass=f=15000', '-ar', '48000', '-ac', '2', rawWavPath]);

  const rawDuration = audioDuration(rawWavPath);
  const slot = segment.end - segment.start;
  const maximumSpeech = Math.max(0.6, slot - 0.3);
  const tempo = rawDuration > maximumSpeech ? Math.min(1.12, rawDuration / maximumSpeech) : 1;
  if (rawDuration / maximumSpeech > 1.12) {
    throw new Error(`${segment.id} is ${rawDuration.toFixed(2)}s for a ${slot.toFixed(2)}s slot; shorten the copy instead of over-speeding it.`);
  }
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', rawWavPath,
    '-af', `atempo=${tempo.toFixed(6)},afade=t=in:st=0:d=0.025,afade=t=out:st=${Math.max(0.05, Math.min(maximumSpeech, rawDuration / tempo) - 0.05).toFixed(3)}:d=0.05`,
    '-ar', '48000', '-ac', '2', fittedWavPath]);

  const finalDuration = audioDuration(fittedWavPath);
  manifest.push({ id: segment.id, start: segment.start, end: segment.end, rawDuration, finalDuration, transcript: transcript.trim() });
  console.log(`${segment.id}: ${finalDuration.toFixed(2)}s in ${slot.toFixed(2)}s slot`);
}

socket.close();

const mixInputs = [];
const mixFilters = [];
config.segments.forEach((segment, index) => {
  const wavPath = resolve(outputRoot, `${segment.id}.wav`);
  if (!existsSync(wavPath)) throw new Error(`Missing rendered segment ${wavPath}.`);
  mixInputs.push('-i', wavPath);
  const delay = Math.round(segment.start * 1000);
  mixFilters.push(`[${index}:a]adelay=${delay}|${delay},aresample=48000[s${index}]`);
});
const labels = config.segments.map((_, index) => `[s${index}]`).join('');
mixFilters.push(`${labels}amix=inputs=${config.segments.length}:duration=longest:normalize=0,apad,atrim=0:${config.runtimeSeconds},loudnorm=I=-16:LRA=7:TP=-1.5[out]`);

const mixPath = resolve(finalRoot, 'narration-119s.wav');
run('ffmpeg', ['-y', '-loglevel', 'error', ...mixInputs, '-filter_complex', mixFilters.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '2', mixPath]);
writeFileSync(resolve(outputRoot, 'manifest.json'), `${JSON.stringify({ ...config, segments: manifest }, null, 2)}\n`, 'utf8');

console.log(mixPath);
