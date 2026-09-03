import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import sharp from 'sharp';
import {
  OVERLAYS,
  SHOTS,
  buildOverlaySvgs,
  buildSlateSvgs,
  validateVideoKitDefinition,
  wrapWords,
  writeVideoKit,
} from '../scripts/render-video-kit.mjs';
import { makePreviewRelease } from '../scripts/submission-data.mjs';

test('video kit locks exactly five overlays outside the approval climax', () => {
  assert.deepEqual(validateVideoKitDefinition(), []);
  assert.equal(OVERLAYS.length, 5);
  assert.deepEqual(OVERLAYS.map(({ file }) => file), [
    'sp_01_run_shortened_1920x1080.svg',
    'sp_02_baseline_human_played_1920x1080.svg',
    'sp_03_proposing_not_applying_1920x1080.svg',
    'sp_04_adapted_human_played_1920x1080.svg',
    'sp_05_end_approval_capability_1920x1080.svg',
  ]);
  assert.equal(OVERLAYS.at(-1).start, '01:57.00');
});

test('animatic shot plan is contiguous and spans exactly 1:59', () => {
  assert.equal(SHOTS.length, 11);
  assert.equal(SHOTS[0].start, 0);
  assert.equal(SHOTS.at(-1).end, 119);
  SHOTS.slice(1).forEach((shot, index) => assert.equal(shot.start, SHOTS[index].end));
});

test('all generated vector assets declare a 1920x1080 canvas', () => {
  const svgs = [
    ...buildOverlaySvgs('Player & Agent').values(),
    ...buildSlateSvgs(),
  ];
  assert.equal(svgs.length, 16);
  svgs.forEach((svg) => {
    assert.match(svg, /width="1920" height="1080" viewBox="0 0 1920 1080"/);
    assert.doesNotMatch(svg, /Player & Agent/);
  });
  assert.match(svgs[4], /Player &amp; Agent/);
});

test('every editor note survives wrapping without dropped words', () => {
  SHOTS.forEach((shot) => {
    assert.equal(wrapWords(shot.body, 30).join(' '), shot.body);
  });
});

test('a worst-case 42-glyph project name stays left of the agent-pane boundary', async () => {
  const svg = [...buildOverlaySvgs('W'.repeat(42)).values()][4];
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let rightmostWhite = -1;
  for (let y = 300; y <= 450; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = ((y * info.width) + x) * info.channels;
      const [red, green, blue, alpha] = data.subarray(offset, offset + info.channels);
      if (alpha > 32 && red > 220 && green > 220 && blue > 220) rightmostWhite = Math.max(rightmostWhite, x);
    }
  }
  assert.ok(rightmostWhite > 242, 'expected the project name to rasterize');
  assert.ok(rightmostWhite <= 1240, `project name reached x=${rightmostWhite}`);
});

test('video kit rasterizer emits true 1920x1080 PNG deliverables', async () => {
  const outputRoot = mkdtempSync(resolve(tmpdir(), 'webmcp-video-kit-'));
  const release = makePreviewRelease({
    project: { tagline: 'Your approval changes what the agent can do.' },
    artifacts: { sitesVersion: 10 },
    buildEvidence: { productTestCount: 52 },
  });
  try {
    const result = await writeVideoKit(release, outputRoot, { animatic: false });
    assert.equal(result.overlaySvgs.size, 5);
    assert.equal(result.slatePngs.length, 11);
    for (const path of [
      resolve(outputRoot, 'overlays', 'sp_01_run_shortened_1920x1080.png'),
      resolve(outputRoot, 'overlays', 'sp_05_end_approval_capability_1920x1080.png'),
      result.slatePngs[4],
    ]) {
      const metadata = await sharp(path).metadata();
      assert.equal(metadata.width, 1920);
      assert.equal(metadata.height, 1080);
    }
    const edl = readFileSync(resolve(outputRoot, 'edit-decisions.csv'), 'utf8');
    assert.match(edl, /00:04\.20/);
    assert.doesNotMatch(edl, /00:37\.00/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
