import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(root, 'submission', 'narration.realtime.json'), 'utf8'));
const out = resolve(root, 'outputs', 'final');
mkdirSync(out, { recursive: true });

const timestamp = (seconds) => {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
};

const wrapCues = (text, max = 40) => {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= max) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  const cues = [];
  for (let index = 0; index < lines.length; index += 2) cues.push(lines.slice(index, index + 2));
  return cues;
};

const blocks = [];
let cueIndex = 1;
for (const segment of config.segments) {
  const cues = wrapCues(segment.text);
  const weights = cues.map((lines) => lines.join(' ').length);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const speechEnd = Math.min(segment.end - 0.15, segment.start + Math.max(1.2, segment.end - segment.start - 0.35));
  let cursor = segment.start;
  cues.forEach((lines, index) => {
    const remainingEnd = index === cues.length - 1
      ? speechEnd
      : cursor + ((speechEnd - segment.start) * (weights[index] / totalWeight));
    blocks.push(`${cueIndex}\n${timestamp(cursor)} --> ${timestamp(remainingEnd)}\n${lines.join('\n')}`);
    cueIndex += 1;
    cursor = remainingEnd;
  });
}

const path = resolve(out, 'MCPilot-demo-captions.srt');
writeFileSync(path, `${blocks.join('\n\n')}\n`, 'utf8');
console.log(path);
