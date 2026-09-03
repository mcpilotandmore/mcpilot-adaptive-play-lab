import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, applyTune, createSampleBaseline } from '../app/core.mjs';
import {
  assertProposalSlotOpen,
  assertMutationAllowed,
  captureTrialLineage,
  capturedLineageIsValid,
  closeTuneLineageForManualEdit,
  getExactAppliedLineage,
  getHandoffCompletion,
  getProposalFreshness,
  getSelectedNeedsLockReason,
  getTrialPresentation,
  findLatestCompletedPair,
  requireMatchingBaseline,
  proposalIntentIsCurrent,
  selectedNeedsFingerprint,
} from '../app/lab-lifecycle.mjs';
import { settingsFingerprint } from '../app/webmcp-contract.mjs';

const makeBaseline = (settings = DEFAULT_SETTINGS) => ({
  ...createSampleBaseline(settings),
  settingsFingerprint: settingsFingerprint(settings),
});

const makeAppliedProposal = (baseline, before, after) => ({
  id: 'plan-exact',
  baselineId: baseline.id,
  status: 'applied',
  baseSettingsFingerprint: settingsFingerprint(before),
  appliedSettingsFingerprint: settingsFingerprint(after),
});

test('plan and settings mutations fail closed during countdown and play', () => {
  assert.doesNotThrow(() => assertMutationAllowed('idle', 'Changing settings'));
  assert.doesNotThrow(() => assertMutationAllowed('complete', 'Undoing a tune'));
  assert.throws(() => assertMutationAllowed('countdown', 'Applying a tune'), /TRIAL_ACTIVE/);
  assert.throws(() => assertMutationAllowed('playing', 'Creating a proposal'), /TRIAL_ACTIVE/);
});

test('a visible proposal cannot be silently replaced at any lifecycle stage', () => {
  assert.doesNotThrow(() => assertProposalSlotOpen(null));
  for (const status of ['pending', 'approved', 'declined', 'applied']) {
    assert.throws(
      () => assertProposalSlotOpen({ id: `plan-${status}`, status }),
      /STATE_CONFLICT/,
      status,
    );
  }
  assert.throws(
    () => assertProposalSlotOpen({ id: 'plan-approved', status: 'approved' }),
    /immutable/,
  );
});

test('proposal freshness binds both settings and player-selected needs', () => {
  const selectedNeeds = ['motion', 'one-hand'];
  const proposal = {
    id: 'plan-bound',
    status: 'approved',
    baseSettingsFingerprint: settingsFingerprint(DEFAULT_SETTINGS),
    selectedNeedsFingerprint: selectedNeedsFingerprint(selectedNeeds),
  };

  assert.deepEqual(
    getProposalFreshness({
      proposal,
      settings: DEFAULT_SETTINGS,
      selectedNeeds: ['one-hand', 'motion'],
    }),
    { stale: false, settingsChanged: false, selectedNeedsChanged: false },
  );
  assert.deepEqual(
    getProposalFreshness({
      proposal,
      settings: { ...DEFAULT_SETTINGS, motion: 'reduced' },
      selectedNeeds,
    }),
    { stale: true, settingsChanged: true, selectedNeedsChanged: false },
  );
  assert.deepEqual(
    getProposalFreshness({ proposal, settings: DEFAULT_SETTINGS, selectedNeeds: ['motion'] }),
    { stale: true, settingsChanged: false, selectedNeedsChanged: true },
  );
});

test('player intent remains fixed from apply through the adapted trial', () => {
  const proposal = {
    id: 'plan-applied',
    status: 'applied',
    selectedNeedsFingerprint: selectedNeedsFingerprint(['motion', 'one-hand']),
  };

  assert.equal(proposalIntentIsCurrent(proposal, ['one-hand', 'motion']), true);
  assert.equal(proposalIntentIsCurrent(proposal, ['motion']), false);
  assert.equal(
    getSelectedNeedsLockReason({ phase: 'playing', proposalStatus: null }),
    'Finish the current run before changing what play should respect.',
  );
  assert.equal(
    getSelectedNeedsLockReason({ phase: 'complete', proposalStatus: 'applied' }),
    'Undo or reset the active tune cycle before changing what play should respect.',
  );
  assert.equal(getSelectedNeedsLockReason({ phase: 'complete', proposalStatus: 'approved' }), null);
});

test('undo starts a truthful new evidence cycle while retaining completed journey history', () => {
  assert.deepEqual(
    getTrialPresentation({ hasExactAppliedTune: false, hasAdaptedSession: true }),
    { currentMode: 'Baseline trial', completedTrialLabel: 'Start new baseline trial' },
  );
  assert.deepEqual(
    getHandoffCompletion({ proposal: null, hasAdaptedSession: true }),
    { proposed: true, approved: true },
  );

  assert.deepEqual(
    getTrialPresentation({ hasExactAppliedTune: true, hasAdaptedSession: true }),
    { currentMode: 'Adapted trial', completedTrialLabel: 'Replay adapted trial' },
  );
});

test('a manual edit closes applied lineage and revokes any stale undo', () => {
  const applied = { id: 'plan-applied', status: 'applied' };
  const closed = closeTuneLineageForManualEdit({
    proposal: applied,
    undoSettings: DEFAULT_SETTINGS,
  });
  assert.deepEqual(closed, { proposal: null, undoSettings: null, lineageClosed: true });

  const restoredUndo = closeTuneLineageForManualEdit({ proposal: null, undoSettings: DEFAULT_SETTINGS });
  assert.equal(restoredUndo.undoSettings, null);
  assert.equal(restoredUndo.lineageClosed, true);

  const pending = { id: 'plan-pending', status: 'pending' };
  const untouched = closeTuneLineageForManualEdit({ proposal: pending, undoSettings: null });
  assert.equal(untouched.proposal, pending);
  assert.equal(untouched.lineageClosed, false);
});

test('a proposal requires current settings to match a completed baseline', () => {
  assert.throws(() => requireMatchingBaseline([], DEFAULT_SETTINGS), /MISSING_STATE/);
  const baseline = makeBaseline();
  assert.equal(requireMatchingBaseline([baseline], DEFAULT_SETTINGS).baseline.id, baseline.id);
  assert.throws(
    () => requireMatchingBaseline([baseline], { ...DEFAULT_SETTINGS, motion: 'reduced' }),
    /STATE_CONFLICT/,
  );
});

test('exact applied lineage binds baseline, proposal, and both fingerprints', () => {
  const baseline = makeBaseline();
  const tuned = applyTune(DEFAULT_SETTINGS, { motion: 'reduced', gameSpeed: 0.8 });
  const proposal = makeAppliedProposal(baseline, DEFAULT_SETTINGS, tuned);
  const lineage = getExactAppliedLineage({ proposal, sessions: [baseline], settings: tuned });

  assert.deepEqual(lineage, {
    baselineId: baseline.id,
    baselineSettingsFingerprint: baseline.settingsFingerprint,
    proposalId: proposal.id,
    appliedSettingsFingerprint: proposal.appliedSettingsFingerprint,
  });
  assert.equal(getExactAppliedLineage({ proposal, sessions: [baseline], settings: DEFAULT_SETTINGS }), null);
  assert.equal(getExactAppliedLineage({ proposal: { ...proposal, baselineId: 'wrong' }, sessions: [baseline], settings: tuned }), null);
  assert.equal(getExactAppliedLineage({ proposal: { ...proposal, status: 'approved' }, sessions: [baseline], settings: tuned }), null);
});

test('trial lineage is captured at start and invalidates on later drift', () => {
  const baseline = makeBaseline();
  const tuned = applyTune(DEFAULT_SETTINGS, { controlMode: 'one-hand-left', gameSpeed: 0.8 });
  const proposal = makeAppliedProposal(baseline, DEFAULT_SETTINGS, tuned);
  const captured = captureTrialLineage({ proposal, sessions: [baseline], settings: tuned });

  assert.equal(captured.mode, 'adapted');
  assert.equal(captured.baselineId, baseline.id);
  assert.equal(captured.appliedProposalId, proposal.id);
  assert.notEqual(captured.settingsSnapshot, tuned);
  assert.equal(capturedLineageIsValid({ trial: captured, proposal, currentSettings: tuned }), true);
  assert.equal(capturedLineageIsValid({
    trial: captured,
    proposal,
    currentSettings: { ...tuned, gameSpeed: 0.9 },
  }), false);
  assert.equal(capturedLineageIsValid({
    trial: captured,
    proposal: { ...proposal, id: 'replacement' },
    currentSettings: tuned,
  }), false);
});

test('the first run cannot be labeled adapted without complete applied lineage', () => {
  const tuned = applyTune(DEFAULT_SETTINGS, { motion: 'reduced' });
  const orphanProposal = {
    id: 'orphan',
    baselineId: 'missing',
    status: 'applied',
    baseSettingsFingerprint: settingsFingerprint(DEFAULT_SETTINGS),
    appliedSettingsFingerprint: settingsFingerprint(tuned),
  };
  const captured = captureTrialLineage({ proposal: orphanProposal, sessions: [], settings: tuned });

  assert.equal(captured.mode, 'baseline');
  assert.equal(captured.baselineId, null);
  assert.equal(captured.appliedProposalId, null);
});

test('completed comparison lineage survives a later settings restore', () => {
  const baseline = makeBaseline();
  const tuned = applyTune(DEFAULT_SETTINGS, { gameSpeed: 0.8 });
  const adapted = {
    ...createSampleBaseline(tuned),
    id: 'played-adapted',
    mode: 'adapted',
    source: 'played',
    baselineId: baseline.id,
    appliedProposalId: 'plan-retained',
    settingsFingerprint: settingsFingerprint(tuned),
  };

  const pair = findLatestCompletedPair([baseline, adapted]);
  assert.equal(pair.baseline.id, baseline.id);
  assert.equal(pair.adapted.id, adapted.id);
  assert.deepEqual(pair.lineage, {
    baselineId: baseline.id,
    baselineSettingsFingerprint: baseline.settingsFingerprint,
    proposalId: 'plan-retained',
    appliedSettingsFingerprint: adapted.settingsFingerprint,
  });
  assert.equal(findLatestCompletedPair([baseline, { ...adapted, appliedProposalId: null }]), null);
});
