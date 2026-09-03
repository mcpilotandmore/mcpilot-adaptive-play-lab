import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_SETTINGS,
  PLAY_COURSE,
  PLAY_COURSE_ID,
  applyTune,
  calculateTrialScore,
  compareSessions,
  createSampleBaseline,
  createSampleTuned,
  deriveSignals,
  getComparisonReadiness,
  inputCodeForDirection,
  isPendingPlayedAdaptedSession,
  meaningfulTuneChanges,
  resolveModelContext,
  sanitizeTuneChanges,
  shouldAccumulateIdle,
} from '../app/core.mjs';
import { HAZARD_PRESENTATION, hazardPresentationFor } from '../app/hazard-presentation.mjs';

const makePlayerCheckIn = (baselineId, outcome = 'skipped') => ({
  status: outcome === 'skipped' ? 'skipped' : 'answered',
  outcome: outcome === 'skipped' ? null : outcome,
  baselineId,
  capturedVia: 'visible_player_ui',
  recordedAt: '2026-08-26T12:00:00.000Z',
});

const asPlayedPair = (baseline, tuned, outcome = 'better') => {
  const playedBaseline = { ...baseline, source: 'played' };
  return [
    playedBaseline,
    {
      ...tuned,
      source: 'played',
      baselineId: playedBaseline.id,
      playerCheckIn: makePlayerCheckIn(playedBaseline.id, outcome),
    },
  ];
};

test('touch directions use the active handedness contract', () => {
  assert.equal(inputCodeForDirection('one-hand-left', 'left'), 'KeyA');
  assert.equal(inputCodeForDirection('one-hand-left', 'up'), 'KeyW');
  assert.equal(inputCodeForDirection('one-hand-right', 'left'), 'ArrowLeft');
  assert.equal(inputCodeForDirection('two-hand', 'down'), 'ArrowDown');
  assert.equal(inputCodeForDirection('single-switch', 'right'), null);
  assert.throws(() => inputCodeForDirection('two-hand', 'diagonal'), /Unsupported direction/);
});

test('idle telemetry uses first switch engagement instead of automatic movement', () => {
  assert.equal(shouldAccumulateIdle('single-switch', true, 0), true);
  assert.equal(shouldAccumulateIdle('single-switch', true, 1), false);
  assert.equal(shouldAccumulateIdle('two-hand', false, 0), true);
  assert.equal(shouldAccumulateIdle('two-hand', true, 0), false);
});

test('course provenance is co-located with the immutable play layout', () => {
  assert.equal(PLAY_COURSE.id, PLAY_COURSE_ID);
  assert.equal(PLAY_COURSE.targets.length, 7);
  assert.equal(PLAY_COURSE.hazards.length, 3);
  assert.equal(Object.isFrozen(PLAY_COURSE), true);
  assert.equal(Object.isFrozen(PLAY_COURSE.targets[0]), true);
  assert.deepEqual(PLAY_COURSE.hazards, [
    { id: 'static-1', x: 44, y: 22, w: 9, h: 23, angle: 7 },
    { id: 'static-2', x: 60, y: 55, w: 13, h: 11, angle: -8 },
    { id: 'static-3', x: 25, y: 42, w: 8, h: 18, angle: 12 },
  ]);
  assert.equal(Object.isFrozen(PLAY_COURSE.hazards[0]), true);
});

test('every immutable hitbox has one unique static hazard presentation', () => {
  const presentations = PLAY_COURSE.hazards.map(({ id }) => hazardPresentationFor(id));
  assert.equal(Object.isFrozen(HAZARD_PRESENTATION), true);
  assert.equal(new Set(presentations.map(({ name }) => name)).size, PLAY_COURSE.hazards.length);
  assert.equal(new Set(presentations.map(({ variant }) => variant)).size, PLAY_COURSE.hazards.length);
  assert.equal(new Set(presentations.map(({ image }) => image)).size, PLAY_COURSE.hazards.length);
  assert.equal(new Set(presentations.map(({ cue }) => cue)).size, PLAY_COURSE.hazards.length);
  for (const presentation of presentations) {
    const assetPath = resolve(process.cwd(), 'public', presentation.image.replace(/^\//, ''));
    assert.equal(existsSync(assetPath), true, `${presentation.name} asset is missing`);
    const asset = readFileSync(assetPath);
    assert.equal(asset.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(asset.includes(Buffer.from('ANIM')), false, `${presentation.name} must remain single-frame`);
  }
  assert.throws(() => hazardPresentationFor('unknown-hazard'), /Missing presentation/);
});

test('trial score uses the same collected, collision, and expired-target contract everywhere', () => {
  assert.equal(calculateTrialScore({ collected: 2, collisions: 4, expired: 5 }), 55);
  assert.equal(calculateTrialScore({ collected: 0, collisions: 99, expired: 7 }), 0);
  for (const sample of [createSampleBaseline(), createSampleTuned(DEFAULT_SETTINGS)]) {
    assert.equal(sample.score, calculateTrialScore(sample), `${sample.id} score drifted from the canonical formula`);
  }
});

test('WebMCP context prefers the current document API and falls back to Chrome 149', () => {
  const current = { registerTool() {} };
  const legacy = { registerTool() {} };
  let legacyReads = 0;
  const readLegacy = () => {
    legacyReads += 1;
    return legacy;
  };
  assert.equal(resolveModelContext(current, readLegacy), current);
  assert.equal(legacyReads, 0);
  assert.equal(resolveModelContext(undefined, readLegacy), legacy);
  assert.equal(legacyReads, 1);
  assert.equal(resolveModelContext({}, () => legacy), legacy);
  assert.equal(resolveModelContext(undefined, () => undefined), null);
});

test('sample baseline exposes multiple evidence-backed friction signals', () => {
  const report = deriveSignals(createSampleBaseline());
  const codes = report.observations.map((item) => item.code);

  assert.equal(report.mode, 'baseline');
  assert.equal(report.source, 'sample');
  assert.equal(report.evidenceGrade, 'fictional_sample');
  assert.ok(codes.includes('collision_pressure'));
  assert.ok(codes.includes('target_precision'));
  assert.ok(codes.includes('input_pauses'));
  assert.ok(codes.includes('direction_imbalance'));
  assert.ok(codes.includes('target_collect_time'));
});

test('tune input accepts only the documented narrow contract', () => {
  assert.deepEqual(
    sanitizeTuneChanges({ controlMode: 'one-hand-left', gameSpeed: 0.8, steeringAssist: 0.25 }),
    { controlMode: 'one-hand-left', gameSpeed: 0.8, steeringAssist: 0.25 },
  );

  assert.throws(() => sanitizeTuneChanges({ secretMode: true }), /Unsupported setting/);
  assert.throws(() => sanitizeTuneChanges({ gameSpeed: 0.2 }), /between 0.6 and 1.25/);
  assert.throws(() => sanitizeTuneChanges({ gameSpeed: 0.63 }), /increments of 0.05/);
  assert.throws(() => sanitizeTuneChanges({ controlMode: 'telepathy' }), /Invalid controlMode/);
  assert.throws(() => sanitizeTuneChanges({}), /At least one setting change/);
});

test('applying a tune is immutable and preserves unspecified settings', () => {
  const before = { ...DEFAULT_SETTINGS };
  const after = applyTune(before, { motion: 'reduced', targetScale: 1.4 });

  assert.notEqual(after, before);
  assert.equal(before.motion, 'full');
  assert.equal(after.motion, 'reduced');
  assert.equal(after.targetScale, 1.4);
  assert.equal(after.controlMode, before.controlMode);
});

test('proposal changes reject a nonempty but no-effect tune', () => {
  assert.throws(
    () => meaningfulTuneChanges(DEFAULT_SETTINGS, { motion: 'full', gameSpeed: 1 }),
    /NO_EFFECT/,
  );
  assert.deepEqual(
    meaningfulTuneChanges(DEFAULT_SETTINGS, { motion: 'full', gameSpeed: 0.8 }),
    { gameSpeed: 0.8 },
  );
});

test('comparison reports a clear improvement for the transparent demo pair', () => {
  const sampleBaseline = createSampleBaseline();
  const tunedSettings = applyTune(DEFAULT_SETTINGS, {
    controlMode: 'one-hand-left',
    motion: 'reduced',
    gameSpeed: 0.8,
    targetScale: 1.5,
    steeringAssist: 0.25,
    collisionForgiveness: 0.35,
  });
  const sampleTuned = createSampleTuned(tunedSettings);
  const [baseline, tuned] = asPlayedPair(sampleBaseline, sampleTuned, 'better');
  const comparison = compareSessions(baseline, tuned);

  assert.equal(comparison.verdict, 'clear_improvement');
  assert.ok(comparison.scoreDelta > 0);
  assert.ok(comparison.accuracyDeltaPoints > 0);
  assert.ok(comparison.collisionRateDeltaPer10s < 0);
  assert.ok(comparison.medianResponseDeltaMs < 0);
  assert.deepEqual(comparison.materialRegressions, []);
});

test('comparison guardrail exposes a material collision tradeoff', () => {
  const sampleBaseline = {
    ...createSampleBaseline(),
    id: 'guardrail-baseline',
    collected: 3,
    expired: 4,
    collisions: 0,
    reactionTimesMs: [2000, 2100, 2200],
    score: 500,
  };
  const sampleTuned = {
    ...sampleBaseline,
    id: 'guardrail-tuned',
    mode: 'adapted',
    collected: 5,
    expired: 2,
    collisions: 2,
    reactionTimesMs: [1500, 1600, 1700, 1800, 1900],
    score: 800,
  };
  const [baseline, tuned] = asPlayedPair(sampleBaseline, sampleTuned, 'same');
  const comparison = compareSessions(baseline, tuned);

  assert.equal(comparison.verdict, 'tradeoff_detected');
  assert.ok(comparison.meaningfulImprovements.includes('score'));
  assert.ok(comparison.meaningfulImprovements.includes('accuracy'));
  assert.ok(comparison.meaningfulImprovements.includes('median_collect_time'));
  assert.deepEqual(comparison.materialRegressions, ['collision_rate']);
  assert.match(comparison.summary, /materially regressed collision rate/);
});

test('comparison verdict matrix respects thresholds and missing response data', () => {
  const baseline = {
    ...createSampleBaseline(),
    id: 'matrix-baseline',
    collected: 4,
    expired: 4,
    collisions: 2,
    reactionTimesMs: [2000],
    score: 500,
  };
  const cases = [
    {
      name: 'two threshold-equal gains are mixed',
      tuned: { score: 600, collected: 5, expired: 3, collisions: 2, reactionTimesMs: [2000] },
      verdict: 'mixed_improvement',
      improvements: ['score', 'accuracy'],
      regressions: [],
    },
    {
      name: 'regressions without gains need another iteration',
      tuned: { score: 400, collected: 3, expired: 5, collisions: 3, reactionTimesMs: [2250] },
      verdict: 'needs_another_iteration',
      improvements: [],
      regressions: ['score', 'accuracy', 'collision_rate', 'median_collect_time'],
    },
    {
      name: 'sub-threshold movement stays neutral',
      tuned: { score: 550, collected: 4, expired: 4, collisions: 2, reactionTimesMs: [1900] },
      verdict: 'needs_another_iteration',
      improvements: [],
      regressions: [],
    },
    {
      name: 'all exact thresholds qualify as clear',
      tuned: { score: 600, collected: 5, expired: 3, collisions: 1, reactionTimesMs: [1750] },
      verdict: 'clear_improvement',
      improvements: ['score', 'accuracy', 'collision_rate', 'median_collect_time'],
      regressions: [],
    },
    {
      name: 'missing response data does not invent a response delta',
      baseline: { reactionTimesMs: [] },
      tuned: { score: 600, collected: 5, expired: 3, collisions: 2, reactionTimesMs: [1750] },
      verdict: 'mixed_improvement',
      improvements: ['score', 'accuracy'],
      regressions: [],
      responseDelta: null,
    },
  ];

  for (const item of cases) {
    const before = { ...baseline, ...item.baseline };
    const candidate = { ...before, id: `matrix-${item.name}`, mode: 'adapted', ...item.tuned };
    const [playedBefore, tuned] = asPlayedPair(before, candidate);
    const result = compareSessions(playedBefore, tuned);
    assert.equal(result.verdict, item.verdict, item.name);
    assert.deepEqual(result.meaningfulImprovements, item.improvements, item.name);
    assert.deepEqual(result.materialRegressions, item.regressions, item.name);
    if ('responseDelta' in item) assert.equal(result.medianResponseDeltaMs, item.responseDelta, item.name);
  }
});

test('sample provenance makes mixed comparisons demo-only', () => {
  const baseline = createSampleBaseline();
  const adapted = {
    ...createSampleTuned(DEFAULT_SETTINGS),
    source: 'played',
    baselineId: baseline.id,
  };
  const comparison = compareSessions(baseline, adapted);

  assert.equal(comparison.verdict, 'demo_only');
  assert.equal(comparison.claimableOutcome, false);
  assert.equal(comparison.evidenceGrade, 'demo_only');
  assert.equal(comparison.baselineSource, 'sample');
  assert.equal(comparison.adaptedSource, 'played');
  assert.deepEqual(comparison.meaningfulImprovements, []);
  assert.match(comparison.summary, /no outcome claim is allowed/);
});

test('played comparison waits for the visible player check-in', () => {
  const baseline = { ...createSampleBaseline(), source: 'played' };
  const adapted = {
    ...createSampleTuned(DEFAULT_SETTINGS),
    source: 'played',
    baselineId: baseline.id,
  };

  assert.equal(getComparisonReadiness(baseline, adapted).comparisonReady, false);
  assert.equal(isPendingPlayedAdaptedSession(adapted, [baseline, adapted]), true);
  assert.equal(isPendingPlayedAdaptedSession(
    { ...adapted, baselineId: 'sample-baseline' },
    [{ ...baseline, id: 'sample-baseline', source: 'sample' }],
  ), false);
  assert.throws(() => compareSessions(baseline, adapted), /PLAYER_CHECK_IN_REQUIRED/);
});

test('skipping unlocks objective-only deltas without a player-outcome claim', () => {
  const [baseline, adapted] = asPlayedPair(
    createSampleBaseline(),
    createSampleTuned(DEFAULT_SETTINGS),
    'skipped',
  );
  const readiness = getComparisonReadiness(baseline, adapted);
  const comparison = compareSessions(baseline, adapted);

  assert.equal(readiness.comparisonReady, true);
  assert.equal(readiness.claimableOutcome, false);
  assert.equal(comparison.verdict, 'objective_only');
  assert.equal(comparison.claimableOutcome, false);
  assert.ok(comparison.meaningfulImprovements.length >= 3);
  assert.match(comparison.summary, /no player-outcome claim/i);
});

test('about the same caps an objective clear result below clear improvement', () => {
  const [baseline, adapted] = asPlayedPair(
    createSampleBaseline(),
    createSampleTuned(DEFAULT_SETTINGS),
    'same',
  );
  const comparison = compareSessions(baseline, adapted);

  assert.equal(comparison.verdict, 'mixed_improvement');
  assert.equal(comparison.claimableOutcome, true);
  assert.match(comparison.summary, /about the same/);
});

test('a worse player check-in vetoes an objective clear improvement', () => {
  const [baseline, adapted] = asPlayedPair(
    createSampleBaseline(),
    createSampleTuned(DEFAULT_SETTINGS),
    'worse',
  );
  const comparison = compareSessions(baseline, adapted);

  assert.equal(comparison.verdict, 'tradeoff_detected');
  assert.equal(comparison.claimableOutcome, true);
  assert.ok(comparison.materialRegressions.includes('player_reported_experience'));
  assert.match(comparison.summary, /worked worse/);
});

test('a better player check-in corroborates but cannot manufacture a stronger verdict', () => {
  const baseline = {
    ...createSampleBaseline(),
    collected: 4,
    expired: 4,
    collisions: 2,
    reactionTimesMs: [2000],
    score: 500,
  };
  const candidate = {
    ...baseline,
    id: 'two-objective-gains',
    mode: 'adapted',
    score: 600,
    collected: 5,
    expired: 3,
  };
  const [playedBaseline, adapted] = asPlayedPair(baseline, candidate, 'better');
  const comparison = compareSessions(playedBaseline, adapted);

  assert.equal(comparison.verdict, 'mixed_improvement');
  assert.deepEqual(comparison.meaningfulImprovements, ['score', 'accuracy']);
  assert.match(comparison.summary, /worked better/);
});

test('comparison rejects mismatched or unknown course provenance', () => {
  const [baseline, adapted] = asPlayedPair(createSampleBaseline(), createSampleTuned(DEFAULT_SETTINGS));
  assert.throws(
    () => compareSessions(baseline, { ...adapted, courseId: 'unknown-course' }),
    /COURSE_MISMATCH/,
  );
});

test('forged or mismatched player check-ins fail closed', () => {
  const [baseline, adapted] = asPlayedPair(createSampleBaseline(), createSampleTuned(DEFAULT_SETTINGS), 'same');
  assert.throws(
    () => compareSessions(baseline, {
      ...adapted,
      playerCheckIn: { ...adapted.playerCheckIn, capturedVia: 'agent_tool' },
    }),
    /visible player UI/,
  );
  assert.throws(
    () => compareSessions(baseline, {
      ...adapted,
      playerCheckIn: { ...adapted.playerCheckIn, baselineId: 'other-baseline' },
    }),
    /baseline lineage/,
  );
  assert.throws(
    () => compareSessions(baseline, {
      ...adapted,
      playerCheckIn: { ...adapted.playerCheckIn, outcome: 'amazing' },
    }),
    /Unsupported player outcome/,
  );
});

test('agent-facing reports remain compact', () => {
  const report = deriveSignals(createSampleBaseline());
  assert.ok(JSON.stringify(report).length < 1500);

  const [baseline, adapted] = asPlayedPair(createSampleBaseline(), createSampleTuned(DEFAULT_SETTINGS), 'worse');
  assert.ok(JSON.stringify(compareSessions(baseline, adapted)).length < 1500);
});
