/**
 * @typedef {Object} GameSettings
 * @property {string} controlMode
 * @property {string} motion
 * @property {string} contrast
 * @property {number} gameSpeed
 * @property {number} targetScale
 * @property {number} steeringAssist
 * @property {number} collisionForgiveness
 * @property {boolean} audioCues
 */

/** @type {Readonly<GameSettings>} */
export const DEFAULT_SETTINGS = Object.freeze({
  controlMode: 'two-hand',
  motion: 'full',
  contrast: 'standard',
  gameSpeed: 1,
  targetScale: 1,
  steeringAssist: 0,
  collisionForgiveness: 0,
  audioCues: false,
});

export const PLAY_COURSE = Object.freeze({
  id: 'signal-course-v1',
  targets: Object.freeze([
    Object.freeze({ id: 'signal-1', x: 70, y: 25 }),
    Object.freeze({ id: 'signal-2', x: 28, y: 31 }),
    Object.freeze({ id: 'signal-3', x: 81, y: 67 }),
    Object.freeze({ id: 'signal-4', x: 19, y: 71 }),
    Object.freeze({ id: 'signal-5', x: 55, y: 18 }),
    Object.freeze({ id: 'signal-6', x: 66, y: 78 }),
    Object.freeze({ id: 'signal-7', x: 35, y: 53 }),
  ]),
  hazards: Object.freeze([
    Object.freeze({ id: 'static-1', x: 44, y: 22, w: 9, h: 23, angle: 7 }),
    Object.freeze({ id: 'static-2', x: 60, y: 55, w: 13, h: 11, angle: -8 }),
    Object.freeze({ id: 'static-3', x: 25, y: 42, w: 8, h: 18, angle: 12 }),
  ]),
});

export const PLAY_COURSE_ID = PLAY_COURSE.id;
export const PLAYER_CHECK_IN_OUTCOMES = Object.freeze(['better', 'same', 'worse']);

export function calculateTrialScore({ collected, collisions, expired }) {
  return Math.max(0, collected * 250 - collisions * 80 - expired * 25);
}

const KEY_DIRECTION_CODES = Object.freeze({
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
});

const ARROW_DIRECTION_CODES = Object.freeze({
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
});

export function inputCodeForDirection(controlMode, direction) {
  if (controlMode === 'single-switch') return null;
  const codes = controlMode === 'one-hand-left' ? KEY_DIRECTION_CODES : ARROW_DIRECTION_CODES;
  if (!(direction in codes)) throw new Error(`Unsupported direction: ${direction}`);
  return codes[direction];
}

export function shouldAccumulateIdle(controlMode, isMoving, inputCount) {
  if (controlMode === 'single-switch') return inputCount === 0;
  return !isMoving;
}

export function resolveModelContext(documentContext, getNavigatorContext) {
  if (typeof documentContext?.registerTool === 'function') return documentContext;
  const navigatorContext = typeof getNavigatorContext === 'function' ? getNavigatorContext() : null;
  return typeof navigatorContext?.registerTool === 'function' ? navigatorContext : null;
}

export const ADAPTATION_CATALOG = Object.freeze({
  controlMode: {
    label: 'Control layout',
    values: ['two-hand', 'one-hand-left', 'one-hand-right', 'single-switch'],
    description: 'Changes the available movement inputs. Single-switch uses Space to rotate direction.',
  },
  motion: {
    label: 'Motion',
    values: ['full', 'reduced', 'none'],
    description: 'Reduces or removes decorative motion while preserving play state.',
  },
  contrast: {
    label: 'Visual contrast',
    values: ['standard', 'high', 'monochrome'],
    description: 'Changes contrast and shape treatment without hiding information.',
  },
  gameSpeed: {
    label: 'Game speed',
    min: 0.6,
    max: 1.25,
    step: 0.05,
    description: 'Scales movement and hazard timing. A lower value gives more response time.',
  },
  targetScale: {
    label: 'Target size',
    min: 1,
    max: 1.8,
    step: 0.1,
    description: 'Makes signal hit areas larger without changing their value.',
  },
  steeringAssist: {
    label: 'Steering assist',
    min: 0,
    max: 0.65,
    step: 0.05,
    description: 'Adds a gentle pull toward the nearest signal while the player moves.',
  },
  collisionForgiveness: {
    label: 'Collision forgiveness',
    min: 0,
    max: 0.55,
    step: 0.05,
    description: 'Shrinks hazard collision zones while keeping hazards visible.',
  },
  audioCues: {
    label: 'Audio cues',
    values: [false, true],
    description: 'Adds distinct collection and collision tones during play.',
  },
});

const round = (value, places = 2) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const formatSignalList = (items) => {
  const labels = items.map((item) => String(item).replaceAll('_', ' '));
  if (labels.length < 2) return labels[0] ?? '';
  if (labels.length === 2) return labels.join(' and ');
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
};

const isPlainObject = (value) => Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value);

const normalizePlayerCheckIn = (session) => {
  const checkIn = session.playerCheckIn;
  if (checkIn == null) return null;
  if (session.mode !== 'adapted' || session.source !== 'played') {
    throw new Error('PLAYER_CHECK_IN_INVALID: Only a played adapted trial can carry a player check-in.');
  }
  if (!isPlainObject(checkIn)) throw new Error('PLAYER_CHECK_IN_INVALID: Check-in must be an object.');
  if (!['answered', 'skipped'].includes(checkIn.status)) {
    throw new Error('PLAYER_CHECK_IN_INVALID: Unsupported check-in status.');
  }
  const outcome = checkIn.status === 'answered' ? checkIn.outcome : null;
  if (checkIn.status === 'answered' && !PLAYER_CHECK_IN_OUTCOMES.includes(outcome)) {
    throw new Error('PLAYER_CHECK_IN_INVALID: Unsupported player outcome.');
  }
  if (checkIn.status === 'skipped' && checkIn.outcome != null) {
    throw new Error('PLAYER_CHECK_IN_INVALID: A skipped check-in cannot include an outcome.');
  }
  if (typeof checkIn.baselineId !== 'string' || checkIn.baselineId !== session.baselineId) {
    throw new Error('PLAYER_CHECK_IN_INVALID: Check-in baseline lineage does not match the adapted trial.');
  }
  if (checkIn.capturedVia !== 'visible_player_ui') {
    throw new Error('PLAYER_CHECK_IN_INVALID: Check-in was not captured through the visible player UI.');
  }
  const recordedAtMs = Date.parse(checkIn.recordedAt);
  if (!Number.isFinite(recordedAtMs)) {
    throw new Error('PLAYER_CHECK_IN_INVALID: Check-in timestamp is invalid.');
  }
  return {
    status: checkIn.status,
    outcome,
    baselineId: checkIn.baselineId,
    capturedVia: 'visible_player_ui',
    recordedAt: new Date(recordedAtMs).toISOString(),
  };
};

const assertComparableCourse = (baseline, tuned) => {
  if (
    baseline.courseId !== PLAY_COURSE_ID
    || tuned.courseId !== PLAY_COURSE_ID
    || baseline.courseId !== tuned.courseId
  ) {
    throw new Error('COURSE_MISMATCH: Trials must use the same recognized play course.');
  }
  if (!['sample', 'played'].includes(baseline.source) || !['sample', 'played'].includes(tuned.source)) {
    throw new Error('EVIDENCE_SOURCE_INVALID: Trial provenance is missing or unsupported.');
  }
};

export function getComparisonReadiness(baseline, tuned) {
  assertComparableCourse(baseline, tuned);
  const playedPair = baseline.source === 'played' && tuned.source === 'played';
  if (!playedPair) {
    if (tuned.playerCheckIn != null) {
      throw new Error('PLAYER_CHECK_IN_INVALID: Demo-only evidence cannot carry a player comparison check-in.');
    }
    return {
      comparisonReady: true,
      evidenceGrade: 'demo_only',
      claimableOutcome: false,
      baselineSource: baseline.source,
      adaptedSource: tuned.source,
      courseId: PLAY_COURSE_ID,
      playerCheckIn: { status: 'not_applicable', outcome: null, capturedVia: null },
    };
  }
  const playerCheckIn = normalizePlayerCheckIn(tuned);
  return {
    comparisonReady: Boolean(playerCheckIn),
    evidenceGrade: 'played_pair',
    claimableOutcome: playerCheckIn?.status === 'answered',
    baselineSource: baseline.source,
    adaptedSource: tuned.source,
    courseId: PLAY_COURSE_ID,
    playerCheckIn: playerCheckIn ?? { status: 'pending', outcome: null, capturedVia: null },
  };
}

export function isPendingPlayedAdaptedSession(session, sessions = []) {
  if (
    !session
    || session.mode !== 'adapted'
    || session.source !== 'played'
    || session.playerCheckIn != null
  ) return false;
  const baseline = sessions.find((item) => item.id === session.baselineId && item.mode === 'baseline');
  return baseline?.source !== 'sample';
}

export function deriveSignals(session) {
  if (session.courseId !== PLAY_COURSE_ID) {
    throw new Error('EVIDENCE_SOURCE_INVALID: Trial course provenance is missing or unsupported.');
  }
  if (!['sample', 'played'].includes(session.source)) {
    throw new Error('EVIDENCE_SOURCE_INVALID: Trial provenance is missing or unsupported.');
  }
  const playerCheckIn = normalizePlayerCheckIn(session);
  const attempts = session.collected + session.expired;
  const accuracy = attempts ? session.collected / attempts : 0;
  const idleRatio = session.durationMs ? session.idleMs / session.durationMs : 0;
  const collisionRate = session.durationMs
    ? session.collisions / (session.durationMs / 10000)
    : 0;
  const responseMedian = median(session.reactionTimesMs ?? []);
  const counts = Object.values(session.directionCounts ?? {});
  const totalDirections = counts.reduce((sum, count) => sum + count, 0);
  const dominantShare = totalDirections ? Math.max(...counts) / totalDirections : 0;
  const singleSwitch = session.settingsSnapshot?.controlMode === 'single-switch';
  const observations = [];

  if (collisionRate >= 1.5) {
    observations.push({
      code: 'collision_pressure',
      severity: 'high',
      evidence: `${session.collisions} collisions in ${round(session.durationMs / 1000, 1)} seconds`,
      suggestion: 'Try more collision forgiveness or a slower pace.',
    });
  }
  if (accuracy < 0.55 && attempts >= 3) {
    observations.push({
      code: 'target_precision',
      severity: accuracy < 0.35 ? 'high' : 'medium',
      evidence: `${Math.round(accuracy * 100)}% of available signals collected`,
      suggestion: 'Try larger targets or gentle steering assist.',
    });
  }
  if (idleRatio > 0.28) {
    observations.push({
      code: 'input_pauses',
      severity: idleRatio > 0.45 ? 'high' : 'medium',
      evidence: singleSwitch
        ? `${Math.round(idleRatio * 100)}% of the trial elapsed before the first switch input`
        : `${Math.round(idleRatio * 100)}% of the trial without movement input`,
      suggestion: singleSwitch
        ? 'Try a slower pace, clearer cues, or another control layout.'
        : 'Try a one-hand or single-switch control layout.',
    });
  }
  if (dominantShare > 0.72 && totalDirections >= 8) {
    observations.push({
      code: 'direction_imbalance',
      severity: 'medium',
      evidence: `${Math.round(dominantShare * 100)}% of direction presses used one direction`,
      suggestion: 'A different control layout may reduce reach or fatigue.',
    });
  }
  if (responseMedian !== null && responseMedian > 2400) {
    observations.push({
      code: 'target_collect_time',
      severity: responseMedian > 3500 ? 'high' : 'medium',
      evidence: `${Math.round(responseMedian)} ms median target-visible-to-collected time`,
      suggestion: 'Try reduced speed or a calmer motion setting.',
    });
  }
  if (!observations.length) {
    observations.push({
      code: 'steady_play',
      severity: 'low',
      evidence: 'No strong friction pattern crossed the demo thresholds.',
      suggestion: 'Preserve the current challenge and change only stated preferences.',
    });
  }

  return {
    sessionId: session.id,
    mode: session.mode,
    source: session.source,
    courseId: session.courseId,
    evidenceGrade: session.source === 'played' ? 'played_trial' : 'fictional_sample',
    playerCheckIn,
    score: session.score,
    accuracyPercent: Math.round(accuracy * 100),
    collisionRatePer10s: round(collisionRate),
    idlePercent: Math.round(idleRatio * 100),
    idleMetric: singleSwitch ? 'before_first_switch_input' : 'without_movement_input',
    medianResponseMs: responseMedian === null ? null : Math.round(responseMedian),
    dominantDirectionPercent: Math.round(dominantShare * 100),
    observations,
  };
}

export const COMPARISON_THRESHOLDS = Object.freeze({
  score: 100,
  accuracyPoints: 5,
  collisionRatePer10s: 0.5,
  medianResponseMs: 250,
});

export function compareSessions(baseline, tuned) {
  const readiness = getComparisonReadiness(baseline, tuned);
  if (!readiness.comparisonReady) {
    throw new Error('PLAYER_CHECK_IN_REQUIRED: Wait for the visible player check-in or explicit skip.');
  }
  const before = deriveSignals(baseline);
  const after = deriveSignals(tuned);
  const scoreDelta = tuned.score - baseline.score;
  const accuracyDelta = after.accuracyPercent - before.accuracyPercent;
  const collisionDelta = round(after.collisionRatePer10s - before.collisionRatePer10s);
  const responseDelta =
    before.medianResponseMs === null || after.medianResponseMs === null
      ? null
      : after.medianResponseMs - before.medianResponseMs;

  const objectiveImprovements = [
    scoreDelta >= COMPARISON_THRESHOLDS.score && 'score',
    accuracyDelta >= COMPARISON_THRESHOLDS.accuracyPoints && 'accuracy',
    collisionDelta <= -COMPARISON_THRESHOLDS.collisionRatePer10s && 'collision_rate',
    responseDelta !== null && responseDelta <= -COMPARISON_THRESHOLDS.medianResponseMs && 'median_collect_time',
  ].filter(Boolean);
  const objectiveRegressions = [
    scoreDelta <= -COMPARISON_THRESHOLDS.score && 'score',
    accuracyDelta <= -COMPARISON_THRESHOLDS.accuracyPoints && 'accuracy',
    collisionDelta >= COMPARISON_THRESHOLDS.collisionRatePer10s && 'collision_rate',
    responseDelta !== null && responseDelta >= COMPARISON_THRESHOLDS.medianResponseMs && 'median_collect_time',
  ].filter(Boolean);

  if (!readiness.claimableOutcome && readiness.evidenceGrade === 'demo_only') {
    return {
      baselineId: baseline.id,
      tunedId: tuned.id,
      courseId: readiness.courseId,
      baselineSource: readiness.baselineSource,
      adaptedSource: readiness.adaptedSource,
      evidenceGrade: readiness.evidenceGrade,
      claimableOutcome: false,
      playerCheckIn: readiness.playerCheckIn,
      scoreDelta,
      accuracyDeltaPoints: accuracyDelta,
      collisionRateDeltaPer10s: collisionDelta,
      medianResponseDeltaMs: responseDelta,
      meaningfulImprovements: [],
      materialRegressions: [],
      verdict: 'demo_only',
      summary: 'Raw deltas demonstrate the workflow only. At least one run is fictional sample evidence, so no outcome claim is allowed.',
    };
  }

  if (!readiness.claimableOutcome) {
    return {
      baselineId: baseline.id,
      tunedId: tuned.id,
      courseId: readiness.courseId,
      baselineSource: readiness.baselineSource,
      adaptedSource: readiness.adaptedSource,
      evidenceGrade: readiness.evidenceGrade,
      claimableOutcome: false,
      playerCheckIn: readiness.playerCheckIn,
      scoreDelta,
      accuracyDeltaPoints: accuracyDelta,
      collisionRateDeltaPer10s: collisionDelta,
      medianResponseDeltaMs: responseDelta,
      meaningfulImprovements: objectiveImprovements,
      materialRegressions: objectiveRegressions,
      verdict: 'objective_only',
      summary: 'The visible experience check-in was skipped. Objective deltas are shown for inspection, but no player-outcome claim is allowed.',
    };
  }

  const meaningfulImprovements = objectiveImprovements;
  const materialRegressions = [
    ...objectiveRegressions,
    ...(readiness.playerCheckIn.outcome === 'worse' ? ['player_reported_experience'] : []),
  ];

  const improved = meaningfulImprovements.length;
  const regressed = materialRegressions.length;
  const objectiveVerdict = regressed > 0 && improved > 0
    ? 'tradeoff_detected'
    : regressed === 0 && improved >= 3
      ? 'clear_improvement'
      : regressed === 0 && improved >= 2
        ? 'mixed_improvement'
        : 'needs_another_iteration';
  const verdict = objectiveVerdict === 'clear_improvement' && readiness.playerCheckIn.outcome !== 'better'
    ? 'mixed_improvement'
    : objectiveVerdict;
  const playerSuffix = readiness.playerCheckIn.outcome === 'better'
      ? ' The visible check-in recorded that the adapted setup worked better.'
      : readiness.playerCheckIn.outcome === 'same'
        ? ' The visible check-in recorded that it worked about the same.'
        : readiness.playerCheckIn.outcome === 'worse'
          ? ' The visible check-in recorded that it worked worse.'
          : '';
  const summary = (verdict === 'clear_improvement'
    ? 'The tuned run crossed the product\'s clear-result threshold without a material regression.'
    : verdict === 'mixed_improvement'
      ? 'The tuned run crossed some improvement thresholds without a material regression.'
      : verdict === 'tradeoff_detected'
        ? `The tune improved ${formatSignalList(meaningfulImprovements)} but materially regressed ${formatSignalList(materialRegressions)}.`
        : 'The current tune did not yet cross enough improvement thresholds without unacceptable regressions.') + playerSuffix;

  return {
    baselineId: baseline.id,
    tunedId: tuned.id,
    courseId: readiness.courseId,
    baselineSource: readiness.baselineSource,
    adaptedSource: readiness.adaptedSource,
    evidenceGrade: readiness.evidenceGrade,
    claimableOutcome: true,
    playerCheckIn: readiness.playerCheckIn,
    scoreDelta,
    accuracyDeltaPoints: accuracyDelta,
    collisionRateDeltaPer10s: collisionDelta,
    medianResponseDeltaMs: responseDelta,
    meaningfulImprovements,
    materialRegressions,
    verdict,
    summary,
  };
}

export function sanitizeTuneChanges(rawChanges) {
  if (!rawChanges || typeof rawChanges !== 'object' || Array.isArray(rawChanges)) {
    throw new Error('changes must be an object');
  }
  const allowedKeys = Object.keys(ADAPTATION_CATALOG);
  const unknownKeys = Object.keys(rawChanges).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length) {
    throw new Error(`Unsupported setting: ${unknownKeys.join(', ')}`);
  }

  const changes = {};
  for (const [key, value] of Object.entries(rawChanges)) {
    const rule = ADAPTATION_CATALOG[key];
    if ('values' in rule) {
      if (!rule.values.includes(value)) throw new Error(`Invalid ${key} value`);
      changes[key] = value;
      continue;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${key} must be a finite number`);
    }
    if (value < rule.min || value > rule.max) {
      throw new Error(`${key} must be between ${rule.min} and ${rule.max}`);
    }
    const stepUnits = (value - rule.min) / rule.step;
    if (Math.abs(stepUnits - Math.round(stepUnits)) > 1e-8) {
      throw new Error(`${key} must use increments of ${rule.step}`);
    }
    changes[key] = round(value, 2);
  }
  if (!Object.keys(changes).length) throw new Error('At least one setting change is required');
  return changes;
}

export function describeChanges(currentSettings, changes) {
  return Object.entries(changes).map(([key, next]) => ({
    key,
    label: ADAPTATION_CATALOG[key].label,
    from: currentSettings[key],
    to: next,
  }));
}

export function meaningfulTuneChanges(currentSettings, rawChanges) {
  const clean = sanitizeTuneChanges(rawChanges);
  const changed = Object.fromEntries(
    Object.entries(clean).filter(([key, value]) => currentSettings[key] !== value),
  );
  if (!Object.keys(changed).length) {
    throw new Error('NO_EFFECT: Proposed values already match the active settings');
  }
  return changed;
}

export function applyTune(currentSettings, changes) {
  const clean = sanitizeTuneChanges(changes);
  return { ...currentSettings, ...clean };
}

export function createSampleBaseline(settings = DEFAULT_SETTINGS) {
  return {
    id: 'sample-baseline',
    mode: 'baseline',
    createdAt: new Date().toISOString(),
    durationMs: 20000,
    collected: 2,
    expired: 5,
    collisions: 4,
    idleMs: 6900,
    inputCount: 19,
    directionChanges: 8,
    directionCounts: { up: 2, down: 1, left: 14, right: 2 },
    reactionTimesMs: [4120, 3360],
    pathDistance: 804,
    score: calculateTrialScore({ collected: 2, collisions: 4, expired: 5 }),
    courseId: PLAY_COURSE_ID,
    settingsSnapshot: { ...settings },
    source: 'sample',
  };
}

export function createSampleTuned(settings) {
  return {
    id: 'sample-tuned',
    mode: 'adapted',
    createdAt: new Date().toISOString(),
    durationMs: 20000,
    collected: 6,
    expired: 1,
    collisions: 1,
    idleMs: 1800,
    inputCount: 27,
    directionChanges: 15,
    directionCounts: { up: 7, down: 5, left: 9, right: 6 },
    reactionTimesMs: [1680, 1340, 1910, 1420, 1520, 1180],
    pathDistance: 1058,
    score: calculateTrialScore({ collected: 6, collisions: 1, expired: 1 }),
    courseId: PLAY_COURSE_ID,
    settingsSnapshot: { ...settings },
    source: 'sample',
  };
}
