import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectMediaTools } from '../scripts/check-media-tools.mjs';

const healthyRunner = (command) => ({
  status: 0,
  stdout: `${command} version 7.1.1\nconfiguration: test`,
  stderr: '',
});

test('media tool preflight requires both FFmpeg executables and Sharp', () => {
  const result = inspectMediaTools({
    runner: healthyRunner,
    sharpVersions: { sharp: '0.35.2', vips: '8.17.3' },
  });
  assert.deepEqual(result.errors, []);
  assert.match(result.versions.ffmpeg, /7\.1\.1/);
  assert.match(result.versions.ffprobe, /7\.1\.1/);
  assert.match(result.versions.sharp, /0\.35\.2/);
});

test('media tool preflight produces an actionable PATH failure', () => {
  const result = inspectMediaTools({
    runner: (command) => command === 'ffmpeg'
      ? { status: null, error: new Error('ENOENT'), stdout: '', stderr: '' }
      : healthyRunner(command),
    sharpVersions: { sharp: '0.35.2', vips: '8.17.3' },
  });
  assert.deepEqual(result.errors, ['ffmpeg is unavailable on PATH']);
});
