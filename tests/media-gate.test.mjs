import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  checkMediaFiles,
  parseLoudnessOutput,
  REQUIRED_MEDIA_REQUIREMENTS,
  validateManifestRuntime,
  validateMediaRequirements,
  validateImageMetadata,
  validateVideoProbe,
} from '../scripts/check-media.mjs';

const requirements = Object.freeze({
  videoWidth: 1920,
  videoHeight: 1080,
  minimumDurationSeconds: 118,
  maximumDurationSeconds: 179.5,
  minimumFrameRate: 24,
  maximumFrameRate: 60,
  minimumAudioSampleRate: 44100,
});

const validProbe = () => ({
  format: { duration: '119.000000' },
  streams: [
    {
      codec_type: 'video',
      codec_name: 'h264',
      width: 1920,
      height: 1080,
      pix_fmt: 'yuv420p',
      avg_frame_rate: '30/1',
    },
    {
      codec_type: 'audio',
      codec_name: 'aac',
      sample_rate: '48000',
      channels: 2,
    },
  ],
});

test('video probe accepts the competition master contract', () => {
  const result = validateVideoProbe(validProbe(), requirements);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.duration, 119);
});

test('video probe rejects low-resolution, overlong, silent masters', () => {
  const probe = validProbe();
  probe.format.duration = '180.1';
  probe.streams[0].width = 1280;
  probe.streams = probe.streams.filter((stream) => stream.codec_type !== 'audio');
  const result = validateVideoProbe(probe, requirements);
  const message = result.errors.join('\n');
  assert.match(message, /below 179\.5s/);
  assert.match(message, /1920x1080/);
  assert.match(message, /Audio stream is missing/);
});

test('video probe fails closed when AAC sample-rate metadata is absent', () => {
  const probe = validProbe();
  delete probe.streams.find((stream) => stream.codec_type === 'audio').sample_rate;
  assert.match(
    validateVideoProbe(probe, requirements).errors.join('\n'),
    /Audio sample rate must be at least 44100 Hz/,
  );
});

test('image gate requires a web-safe 16:9 asset at minimum dimensions', () => {
  assert.deepEqual(validateImageMetadata(
    { format: 'png', width: 1920, height: 1080 },
    'Thumbnail',
    1280,
    720,
  ), []);
  const errors = validateImageMetadata(
    { format: 'tiff', width: 800, height: 800 },
    'Thumbnail',
    1280,
    720,
  ).join('\n');
  assert.match(errors, /PNG, JPEG, or WebP/);
  assert.match(errors, /at least 1280x720/);
  assert.match(errors, /16:9/);
});

test('loudness parser uses the final EBU summary rather than an early frame', () => {
  const output = `
    I: -31.2 LUFS
    Peak: -8.0 dBFS
    Integrated loudness:
    I: -14.1 LUFS
    True peak:
    Peak: -1.3 dBFS
  `;
  assert.deepEqual(parseLoudnessOutput(output), {
    integratedLufs: -14.1,
    truePeakDbfs: -1.3,
  });
});

test('loudness parser preserves silent-audio negative infinity', () => {
  assert.deepEqual(parseLoudnessOutput('I: -inf LUFS\nPeak: -inf dBFS'), {
    integratedLufs: Number.NEGATIVE_INFINITY,
    truePeakDbfs: Number.NEGATIVE_INFINITY,
  });
});

test('actual and published video runtimes must agree within half a second', () => {
  assert.deepEqual(validateManifestRuntime(118.8, 119), []);
  assert.match(validateManifestRuntime(116.2, 119).join('\n'), /does not match manifest runtime/);
});

test('the media contract cannot be weakened in configuration', () => {
  assert.deepEqual(validateMediaRequirements({ ...REQUIRED_MEDIA_REQUIREMENTS }), []);
  const errors = validateMediaRequirements({
    ...REQUIRED_MEDIA_REQUIREMENTS,
    minimumDurationSeconds: 1,
    videoWidth: 640,
    maximumTruePeakDbfs: 0,
    surpriseOverride: true,
  }).join('\n');
  assert.match(errors, /minimumDurationSeconds must remain 118/);
  assert.match(errors, /videoWidth must remain 1920/);
  assert.match(errors, /maximumTruePeakDbfs must remain -1/);
  assert.match(errors, /unexpected keys: surpriseOverride/);
});

test('the standalone media gate rejects a non-object release manifest', async () => {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'webmcp-media-gate-'));
  const configPath = resolve(temporaryRoot, 'submission.media.json');
  const releasePath = resolve(temporaryRoot, 'submission.release.json');
  writeFileSync(configPath, JSON.stringify({
    schemaVersion: 1,
    videoPath: 'outputs/final/missing.mp4',
    captionsPath: 'outputs/final/missing.srt',
    thumbnailPath: 'outputs/final/missing.png',
    galleryPaths: [
      'outputs/final/missing-1.png',
      'outputs/final/missing-2.png',
      'outputs/final/missing-3.png',
    ],
    requirements: REQUIRED_MEDIA_REQUIREMENTS,
  }));
  writeFileSync(releasePath, 'null');
  try {
    const result = await checkMediaFiles({ configPath, releasePath });
    assert.match(result.errors.join('\n'), /submission\.release\.json must contain an object/);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
