import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, createSampleBaseline, createSampleTuned } from '../app/core.mjs';
import {
  LAB_STATE_VERSION,
  restorePersistedLab,
  serializePersistedLab,
} from '../app/persistence.mjs';
import { settingsFingerprint } from '../app/webmcp-contract.mjs';

test('missing or corrupt storage restores safe defaults', () => {
  assert.deepEqual(restorePersistedLab(null).settings, DEFAULT_SETTINGS);
  const corrupt = restorePersistedLab('{not-json');
  assert.deepEqual(corrupt.settings, DEFAULT_SETTINGS);
  assert.deepEqual(corrupt.sessions, []);
  assert.equal(corrupt.undoSettings, null);
  assert.equal(corrupt.recoveredFromInvalidState, true);
});

test('restoration validates settings and filters selected needs', () => {
  const restored = restorePersistedLab(JSON.stringify({
    version: LAB_STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS, motion: 'reduced' },
    selectedNeeds: ['motion', 'unknown', 'motion', 'one-hand'],
    sessions: [],
  }));

  assert.equal(restored.settings.motion, 'reduced');
  assert.deepEqual(restored.selectedNeeds, ['motion', 'one-hand']);
  assert.equal(restored.recoveredFromInvalidState, false);

  const poisoned = restorePersistedLab(JSON.stringify({
    version: LAB_STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS, hiddenOverride: true },
  }));
  assert.deepEqual(poisoned.settings, DEFAULT_SETTINGS);
  assert.equal(poisoned.recoveredFromInvalidState, true);
});

test('only a validated baseline is restored; adapted evidence is fail-closed', () => {
  const baseline = createSampleBaseline();
  const adapted = createSampleTuned({ ...DEFAULT_SETTINGS, gameSpeed: 0.8 });
  const restored = restorePersistedLab(JSON.stringify({
    version: LAB_STATE_VERSION,
    settings: DEFAULT_SETTINGS,
    sessions: [baseline, adapted],
    selectedNeeds: ['one-hand'],
  }));

  assert.equal(restored.sessions.length, 1);
  assert.equal(restored.sessions[0].id, baseline.id);
  assert.equal(restored.sessions[0].mode, 'baseline');
  assert.equal(restored.sessions[0].settingsFingerprint, settingsFingerprint(DEFAULT_SETTINGS));
});

test('reload preserves a distinct undo snapshot without restoring approval', () => {
  const tuned = { ...DEFAULT_SETTINGS, motion: 'reduced', gameSpeed: 0.8 };
  const baseline = {
    ...createSampleBaseline(),
    settingsFingerprint: settingsFingerprint(DEFAULT_SETTINGS),
  };
  const serialized = serializePersistedLab({
    settings: tuned,
    undoSettings: DEFAULT_SETTINGS,
    sessions: [baseline],
    selectedNeeds: ['motion'],
    proposal: { id: 'must-not-persist', status: 'approved' },
  });
  const raw = JSON.parse(serialized);
  const restored = restorePersistedLab(serialized);

  assert.equal(raw.proposal, undefined);
  assert.deepEqual(restored.settings, tuned);
  assert.deepEqual(restored.undoSettings, DEFAULT_SETTINGS);
  assert.equal(restored.sessions[0].id, baseline.id);
});

test('tampered session fingerprints invalidate the saved state', () => {
  const baseline = {
    ...createSampleBaseline(),
    settingsFingerprint: 'tampered',
  };
  const restored = restorePersistedLab(JSON.stringify({
    version: LAB_STATE_VERSION,
    settings: DEFAULT_SETTINGS,
    sessions: [baseline],
  }));

  assert.deepEqual(restored.sessions, []);
  assert.equal(restored.recoveredFromInvalidState, true);
});

test('missing or unknown course provenance invalidates restored evidence', () => {
  const baseline = createSampleBaseline();
  const restored = restorePersistedLab(JSON.stringify({
    version: LAB_STATE_VERSION,
    settings: DEFAULT_SETTINGS,
    sessions: [{ ...baseline, courseId: 'unknown-course' }],
  }));

  assert.deepEqual(restored.sessions, []);
  assert.equal(restored.recoveredFromInvalidState, true);
});

test('played evidence restores only when its fixed-course arithmetic is coherent', () => {
  const played = {
    ...createSampleBaseline(),
    id: 'trial-valid-baseline',
    source: 'played',
    score: 55,
    settingsFingerprint: settingsFingerprint(DEFAULT_SETTINGS),
  };
  const restored = restorePersistedLab(JSON.stringify({
    version: LAB_STATE_VERSION,
    settings: DEFAULT_SETTINGS,
    sessions: [played],
  }));

  assert.equal(restored.sessions[0].id, played.id);
  assert.equal(restored.recoveredFromInvalidState, false);

  const impossible = restorePersistedLab(JSON.stringify({
    version: LAB_STATE_VERSION,
    settings: DEFAULT_SETTINGS,
    sessions: [{ ...played, durationMs: 1, collected: 1000, score: 10000000 }],
  }));
  assert.deepEqual(impossible.sessions, []);
  assert.equal(impossible.recoveredFromInvalidState, true);
});

test('played evidence rejects inconsistent target, input, reaction, timing, and score relationships', () => {
  const played = {
    ...createSampleBaseline(),
    id: 'trial-coherent-baseline',
    source: 'played',
    score: 55,
    settingsFingerprint: settingsFingerprint(DEFAULT_SETTINGS),
  };
  const corruptions = [
    { expired: 4 },
    { idleMs: 20001 },
    { inputCount: 18 },
    { directionChanges: 19 },
    { reactionTimesMs: [4120] },
    { score: 180 },
    { directionCounts: { ...played.directionCounts, sideways: 1 } },
  ];

  for (const corruption of corruptions) {
    const restored = restorePersistedLab(JSON.stringify({
      version: LAB_STATE_VERSION,
      settings: DEFAULT_SETTINGS,
      sessions: [{ ...played, ...corruption }],
    }));
    assert.deepEqual(restored.sessions, []);
    assert.equal(restored.recoveredFromInvalidState, true);
  }
});

test('fictional sample provenance accepts only the canonical sample payload', () => {
  const sample = createSampleBaseline();
  const valid = restorePersistedLab(JSON.stringify({
    version: LAB_STATE_VERSION,
    settings: DEFAULT_SETTINGS,
    sessions: [sample],
  }));
  assert.equal(valid.sessions[0].id, 'sample-baseline');

  for (const corruption of [{ score: 181 }, { id: 'sample-lookalike' }, { collected: 3, expired: 4 }]) {
    const restored = restorePersistedLab(JSON.stringify({
      version: LAB_STATE_VERSION,
      settings: DEFAULT_SETTINGS,
      sessions: [{ ...sample, ...corruption }],
    }));
    assert.deepEqual(restored.sessions, []);
    assert.equal(restored.recoveredFromInvalidState, true);
  }
});
