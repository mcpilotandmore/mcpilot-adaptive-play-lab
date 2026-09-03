import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  deriveEvidence,
  isReleaseManifestObject,
  makePreviewRelease,
  validatePackRelease,
} from '../scripts/submission-data.mjs';
import {
  READY_FILES,
  renderSubmissionFiles,
  validateSrt,
} from '../scripts/submission-render.mjs';

const previewRelease = () => makePreviewRelease({
  project: { tagline: 'Your approval changes what the agent can do.' },
  artifacts: { sitesVersion: 10 },
  buildEvidence: { productTestCount: 52 },
});

const qualifyingRelease = () => {
  const release = previewRelease();
  release.humanEvidence.playerCheckIn = 'better';
  release.humanEvidence.verdict = 'clear_improvement';
  release.humanEvidence.playerObservation = 'The adapted run felt easier during the recorded check-in.';
  return release;
};

test('preview release renders a deterministic six-file packet without unresolved tokens', () => {
  const first = renderSubmissionFiles(previewRelease());
  const second = renderSubmissionFiles(previewRelease());

  assert.deepEqual(first.errors, []);
  assert.deepEqual(second.errors, []);
  assert.equal(first.files.size, Object.keys(READY_FILES).length);
  assert.deepEqual([...first.files], [...second.files]);
  for (const contents of first.files.values()) {
    assert.doesNotMatch(contents, /\{\{[^}]+\}\}/);
    assert.equal(contents.endsWith('\n'), true);
  }
});

test('absolute evidence values derive the public deltas and qualifying verdict', () => {
  const release = qualifyingRelease();
  const derived = deriveEvidence(release.humanEvidence);

  assert.deepEqual(derived.errors, []);
  assert.deepEqual(derived.deltas, {
    scoreDelta: 100,
    accuracyDeltaPoints: 10,
    collisionRateDeltaPer10s: -0.5,
    medianResponseDeltaMs: -300,
  });
  assert.equal(derived.verdict, 'clear_improvement');
  assert.equal(derived.headlineSentence, 'Accuracy: 70% to 80% (+10 pt).');
});

test('missing evidence returns actionable errors instead of throwing', () => {
  assert.doesNotThrow(() => deriveEvidence(undefined));
  const result = deriveEvidence(undefined);
  assert.ok(result.errors.length >= 10);
  assert.match(result.errors.join('\n'), /baselineTrialId/);
});

test('falsey, array, and primitive release manifests cannot bypass validation', () => {
  for (const value of [null, false, 0, '', [], 'release']) {
    assert.equal(isReleaseManifestObject(value), false);
  }
  assert.equal(isReleaseManifestObject({}), true);
});

test('a manifest cannot assert a verdict that contradicts its evidence', () => {
  const release = qualifyingRelease();
  release.humanEvidence.verdict = 'needs_another_iteration';
  const validation = validatePackRelease(release);

  assert.match(validation.errors.join('\n'), /Verdict mismatch: expected clear_improvement/);
});

test('a skipped player check-in produces objective-only copy without a player quote', () => {
  const release = previewRelease();
  release.humanEvidence.playerCheckIn = 'skipped';
  release.humanEvidence.verdict = 'objective_only';
  release.humanEvidence.playerObservation = null;
  const rendered = renderSubmissionFiles(release);

  assert.deepEqual(rendered.errors, []);
  assert.match(rendered.files.get('DEVPOST.md'), /player skipped the check-in/i);
  assert.doesNotMatch(rendered.files.get('DEVPOST.md'), /selected Better/);
});

test('a skipped check-in requires a literal null player observation', () => {
  for (const playerObservation of ['', 123, {}, 'TBD', undefined]) {
    const release = previewRelease();
    release.humanEvidence.playerObservation = playerObservation;
    assert.match(deriveEvidence(release.humanEvidence).errors.join('\n'), /must be null/);
  }
});

test('preview artifacts are globally marked and cannot validate as a final release', () => {
  const release = previewRelease();
  const rendered = renderSubmissionFiles(release);
  assert.deepEqual(rendered.errors, []);
  assert.match(rendered.files.get('DEVPOST.md'), /^> PREVIEW ONLY/);
  assert.match(rendered.files.get('YOUTUBE_TITLE.txt'), /^\[PREVIEW ONLY\]/);
  assert.match(rendered.files.get('DEMO_CAPTIONS.srt'), /Fictional preview:/);
  assert.match(validatePackRelease(release).errors.join('\n'), /preview-only sentinel values/);
});

test('optional Devpost URL rejects placeholders, injection, and non-Devpost hosts', () => {
  for (const devpostUrl of ['TBD', 'https://example.com/project', 'https://devpost.com/software/demo\ninjected']) {
    const release = qualifyingRelease();
    release._previewOnly = false;
    release.project.name = 'Release Name';
    release.artifacts.releaseTag = 'release-name-v1';
    release.artifacts.applicationCommit = '1'.repeat(40);
    release.artifacts.liveUrl = 'https://app.example.org';
    release.artifacts.repositoryUrl = 'https://github.com/example/project';
    release.artifacts.videoUrl = 'https://youtu.be/abcdefghi';
    release.humanEvidence.baselineTrialId = 'trial-release-baseline';
    release.humanEvidence.adaptedTrialId = 'trial-release-adapted';
    release.artifacts.devpostUrl = devpostUrl;
    assert.match(validatePackRelease(release).errors.join('\n'), /Devpost URL/);
  }
});

test('caption validation rejects long lines, overlaps, and cues beyond runtime', () => {
  const badSrt = [
    '1',
    '00:00:00,000 --> 00:00:03,000',
    'This caption line is deliberately much longer than forty-two characters.',
    '',
    '2',
    '00:00:02,000 --> 00:00:06,000',
    'Overlap.',
    '',
  ].join('\n');
  const errors = validateSrt(badSrt, 5);

  assert.match(errors.join('\n'), /exceeds 42 characters/);
  assert.match(errors.join('\n'), /overlaps the previous cue/);
  assert.match(errors.join('\n'), /after the 5s video/);
});

test('the exact 1:59 preview captions satisfy the readability contract', () => {
  const rendered = renderSubmissionFiles(previewRelease());
  assert.deepEqual(validateSrt(rendered.files.get('DEMO_CAPTIONS.srt'), 119), []);
});

test('template typos fail closed instead of leaking tokens into public copy', () => {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'webmcp-submission-'));
  const sourceRoot = resolve(process.cwd(), 'submission', 'templates');
  try {
    cpSync(sourceRoot, temporaryRoot, { recursive: true });
    writeFileSync(
      resolve(temporaryRoot, 'YOUTUBE_TITLE.txt.tmpl'),
      '{{PROJECT_NAME}} {{MISSPELLED_TOKEN}}\n',
      'utf8',
    );
    const rendered = renderSubmissionFiles(previewRelease(), { templateRoot: temporaryRoot });
    assert.match(rendered.errors.join('\n'), /unknown tokens: MISSPELLED_TOKEN/);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('tracked caption template and rendered preview retain the same cue count', () => {
  const template = readFileSync(resolve(process.cwd(), 'submission', 'templates', 'DEMO_CAPTIONS.srt.tmpl'), 'utf8');
  const rendered = renderSubmissionFiles(previewRelease()).files.get('DEMO_CAPTIONS.srt');
  assert.equal((template.match(/^\d+$/gm) ?? []).length, 25);
  assert.equal((rendered.match(/^\d+$/gm) ?? []).length, 25);
});
