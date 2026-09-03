import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGalleryOverlay,
  buildThumbnailOverlay,
} from '../scripts/compose-media-images.mjs';

test('thumbnail overlay is a 1280x720 claim-safe SVG and escapes the project name', () => {
  const svg = buildThumbnailOverlay('Player & Agent').toString('utf8');
  assert.match(svg, /width="1280" height="720" viewBox="0 0 1280 720"/);
  assert.match(svg, /PLAYER APPROVAL/);
  assert.match(svg, /CREATES TOOL 7/);
  assert.match(svg, /Player &amp; Agent/);
  assert.doesNotMatch(svg, /Player & Agent/);
});

test('gallery overlays retain title-safe top and bottom placements', () => {
  const top = buildGalleryOverlay('08 · COMPARE ADDED', 'top').toString('utf8');
  const bottom = buildGalleryOverlay('06 · APPLY ABSENT', 'bottom').toString('utf8');
  assert.match(top, /y="108"/);
  assert.match(bottom, /y="874"/);
  assert.match(top, /width="1920" height="1080" viewBox="0 0 1920 1080"/);
});
