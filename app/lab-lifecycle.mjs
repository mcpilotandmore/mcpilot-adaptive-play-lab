import { settingsFingerprint } from './webmcp-contract.mjs';

export const isTrialActive = (phase) => phase === 'countdown' || phase === 'playing';

export function getTrialPresentation({ hasExactAppliedTune, hasAdaptedSession }) {
  return {
    currentMode: hasExactAppliedTune ? 'Adapted trial' : 'Baseline trial',
    completedTrialLabel: hasExactAppliedTune
      ? hasAdaptedSession ? 'Replay adapted trial' : 'Start adapted trial'
      : hasAdaptedSession ? 'Start new baseline trial' : 'Replay baseline trial',
  };
}

export function getHandoffCompletion({ proposal, hasAdaptedSession }) {
  return {
    proposed: Boolean((proposal && proposal.status !== 'declined') || hasAdaptedSession),
    approved: Boolean((proposal && ['approved', 'applied'].includes(proposal.status)) || hasAdaptedSession),
  };
}

export function assertMutationAllowed(phase, action) {
  if (isTrialActive(phase)) {
    throw new Error(`TRIAL_ACTIVE: ${action} is unavailable until the current trial ends.`);
  }
}

export function closeTuneLineageForManualEdit({ proposal, undoSettings }) {
  const proposalWasApplied = proposal?.status === 'applied';
  const undoWasAvailable = Boolean(undoSettings);
  return {
    proposal: proposalWasApplied ? null : proposal ?? null,
    undoSettings: null,
    lineageClosed: proposalWasApplied || undoWasAvailable,
  };
}

export const selectedNeedsFingerprint = (selectedNeeds = []) => JSON.stringify(
  [...new Set(selectedNeeds)].sort(),
);

export function getSelectedNeedsLockReason({ phase, proposalStatus }) {
  if (isTrialActive(phase)) {
    return 'Finish the current run before changing what play should respect.';
  }
  if (proposalStatus === 'applied') {
    return 'Undo or reset the active tune cycle before changing what play should respect.';
  }
  return null;
}

export const proposalIntentIsCurrent = (proposal, selectedNeeds) => Boolean(
  proposal
  && proposal.selectedNeedsFingerprint === selectedNeedsFingerprint(selectedNeeds),
);

export function assertProposalSlotOpen(proposal) {
  if (!proposal) return;
  const nextStep = proposal.status === 'pending'
    ? 'The visible plan is awaiting player review and cannot be replaced.'
    : proposal.status === 'approved'
      ? 'The player-approved plan is immutable; apply it or let the player clear it.'
      : proposal.status === 'declined'
        ? 'The declined plan remains visible until the player clears it.'
        : 'Finish or undo the active tune cycle before proposing another plan.';
  throw new Error(`STATE_CONFLICT: ${nextStep}`);
}

export function getProposalFreshness({ proposal, settings, selectedNeeds }) {
  if (!proposal || !['pending', 'approved'].includes(proposal.status)) {
    return { stale: false, settingsChanged: false, selectedNeedsChanged: false };
  }
  const settingsChanged = proposal.baseSettingsFingerprint !== settingsFingerprint(settings);
  const selectedNeedsChanged = !proposalIntentIsCurrent(proposal, selectedNeeds);
  return {
    stale: settingsChanged || selectedNeedsChanged,
    settingsChanged,
    selectedNeedsChanged,
  };
}

export function findLatestBaseline(sessions) {
  return [...sessions].reverse().find((item) => item.mode === 'baseline') ?? null;
}

export function findLatestCompletedPair(sessions) {
  for (const adapted of [...sessions].reverse()) {
    if (
      adapted?.mode !== 'adapted'
      || typeof adapted.baselineId !== 'string'
      || typeof adapted.appliedProposalId !== 'string'
      || typeof adapted.settingsFingerprint !== 'string'
    ) continue;
    const baseline = sessions.find((item) => (
      item?.mode === 'baseline'
      && item.id === adapted.baselineId
      && typeof item.settingsFingerprint === 'string'
    ));
    if (baseline) {
      return {
        baseline,
        adapted,
        lineage: {
          baselineId: baseline.id,
          baselineSettingsFingerprint: baseline.settingsFingerprint,
          proposalId: adapted.appliedProposalId,
          appliedSettingsFingerprint: adapted.settingsFingerprint,
        },
      };
    }
  }
  return null;
}

export function requireMatchingBaseline(sessions, settings) {
  const baseline = findLatestBaseline(sessions);
  if (!baseline) {
    throw new Error('MISSING_STATE: Complete a baseline or explicitly load the sample baseline before proposing a tune.');
  }
  const currentFingerprint = settingsFingerprint(settings);
  if (baseline.settingsFingerprint !== currentFingerprint) {
    throw new Error('STATE_CONFLICT: Settings changed after the baseline. Complete a fresh baseline before proposing a tune.');
  }
  return { baseline, currentFingerprint };
}

export function getExactAppliedLineage({ proposal, sessions, settings }) {
  if (proposal?.status !== 'applied' || typeof proposal.appliedSettingsFingerprint !== 'string') return null;
  const currentFingerprint = settingsFingerprint(settings);
  if (proposal.appliedSettingsFingerprint !== currentFingerprint) return null;
  const baseline = sessions.find((item) => item.mode === 'baseline' && item.id === proposal.baselineId);
  if (!baseline || baseline.settingsFingerprint !== proposal.baseSettingsFingerprint) return null;
  return {
    baselineId: baseline.id,
    baselineSettingsFingerprint: baseline.settingsFingerprint,
    proposalId: proposal.id,
    appliedSettingsFingerprint: proposal.appliedSettingsFingerprint,
  };
}

export function captureTrialLineage({ proposal, sessions, settings }) {
  const settingsSnapshot = { ...settings };
  const fingerprint = settingsFingerprint(settingsSnapshot);
  const lineage = getExactAppliedLineage({ proposal, sessions, settings: settingsSnapshot });
  return {
    mode: lineage ? 'adapted' : 'baseline',
    settingsSnapshot,
    settingsFingerprint: fingerprint,
    baselineId: lineage?.baselineId ?? null,
    appliedProposalId: lineage?.proposalId ?? null,
  };
}

export function capturedLineageIsValid({ trial, proposal, currentSettings }) {
  if (trial.mode === 'baseline') return true;
  return Boolean(
    proposal?.status === 'applied'
    && proposal.id === trial.appliedProposalId
    && proposal.appliedSettingsFingerprint === trial.settingsFingerprint
    && settingsFingerprint(currentSettings) === trial.settingsFingerprint,
  );
}
