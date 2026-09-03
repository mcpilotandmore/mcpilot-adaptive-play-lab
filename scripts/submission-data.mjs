import { COMPARISON_THRESHOLDS } from '../app/core.mjs';

export const METRIC_KEYS = Object.freeze([
  'score',
  'accuracyPercent',
  'collisionRatePer10s',
  'medianResponseMs',
]);

export const VERDICTS = Object.freeze([
  'clear_improvement',
  'mixed_improvement',
  'needs_another_iteration',
  'tradeoff_detected',
  'objective_only',
]);

export const CHECK_INS = Object.freeze(['better', 'same', 'worse', 'skipped']);

export const isReleaseManifestObject = (value) => Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value);

const round = (value, places = 2) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const hasToken = (value) => /\[[^\]]+\]|\{[^}]+\}|\b(?:TBD|TODO|PENDING)\b/i.test(value);

export const isResolvedText = (value, { max = 240 } = {}) => typeof value === 'string'
  && value.trim().length > 0
  && value.trim().length <= max
  && !/[\r\n\u0000-\u001f\u007f]/.test(value)
  && !hasToken(value)
  && !/^(?:unknown|null|n\/a|none)$/i.test(value.trim());

const formatNumber = (value, places = 2) => {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(places).replace(/0+$/, '').replace(/\.$/, '');
};

const formatSigned = (value, suffix = '') => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value)}${suffix}`;
};

const validateMetric = (value, key, label, errors) => {
  if (key === 'medianResponseMs' && value === null) return;
  if (!Number.isFinite(value)) {
    errors.push(`${label}.${key} must be a finite number${key === 'medianResponseMs' ? ' or null' : ''}`);
    return;
  }
  if (['score', 'accuracyPercent', 'medianResponseMs'].includes(key) && !Number.isInteger(value)) {
    errors.push(`${label}.${key} must be an integer`);
  }
  if (key === 'accuracyPercent' && (value < 0 || value > 100)) {
    errors.push(`${label}.accuracyPercent must be between 0 and 100`);
  }
  if (key === 'collisionRatePer10s' && value < 0) {
    errors.push(`${label}.collisionRatePer10s must not be negative`);
  }
  if (key === 'medianResponseMs' && value < 0) {
    errors.push(`${label}.medianResponseMs must not be negative`);
  }
};

export const expectedVerdictFor = ({
  playerCheckIn,
  scoreDelta,
  accuracyDeltaPoints,
  collisionRateDeltaPer10s,
  medianResponseDeltaMs,
}) => {
  if (playerCheckIn === 'skipped') return 'objective_only';
  const improvements = [
    scoreDelta >= COMPARISON_THRESHOLDS.score,
    accuracyDeltaPoints >= COMPARISON_THRESHOLDS.accuracyPoints,
    collisionRateDeltaPer10s <= -COMPARISON_THRESHOLDS.collisionRatePer10s,
    medianResponseDeltaMs !== null
      && medianResponseDeltaMs <= -COMPARISON_THRESHOLDS.medianResponseMs,
  ].filter(Boolean).length;
  const regressions = [
    scoreDelta <= -COMPARISON_THRESHOLDS.score,
    accuracyDeltaPoints <= -COMPARISON_THRESHOLDS.accuracyPoints,
    collisionRateDeltaPer10s >= COMPARISON_THRESHOLDS.collisionRatePer10s,
    medianResponseDeltaMs !== null
      && medianResponseDeltaMs >= COMPARISON_THRESHOLDS.medianResponseMs,
    playerCheckIn === 'worse',
  ].filter(Boolean).length;
  const objectiveVerdict = regressions > 0 && improvements > 0
    ? 'tradeoff_detected'
    : regressions === 0 && improvements >= 3
      ? 'clear_improvement'
      : regressions === 0 && improvements >= 2
        ? 'mixed_improvement'
        : 'needs_another_iteration';
  return objectiveVerdict === 'clear_improvement' && playerCheckIn !== 'better'
    ? 'mixed_improvement'
    : objectiveVerdict;
};

const verdictSentences = Object.freeze({
  clear_improvement: 'Multiple objective measures cleared their thresholds, the player selected Better, and no material regression appeared.',
  mixed_improvement: 'Some objective measures cleared their thresholds without a material regression, but the result did not qualify as a clear improvement.',
  needs_another_iteration: 'The run did not produce enough qualifying gains to clear the product\'s success policy, so the page calls for another iteration.',
  tradeoff_detected: 'At least one measure improved while another measure or the player\'s report materially regressed, so the page reports a tradeoff.',
  objective_only: 'The player skipped the check-in, so the page reports objective deltas without making an outcome claim.',
});

const verdictLabels = Object.freeze({
  clear_improvement: 'clear improvement',
  mixed_improvement: 'mixed improvement',
  needs_another_iteration: 'needs another iteration',
  tradeoff_detected: 'tradeoff detected',
  objective_only: 'objective only',
});

const metricLabels = Object.freeze({
  score: 'Score',
  accuracyPercent: 'Accuracy',
  collisionRatePer10s: 'Collision rate',
  medianResponseMs: 'Median collect time',
});

const metricDisplay = (key, value) => {
  if (value === null) return 'Unavailable';
  if (key === 'accuracyPercent') return `${formatNumber(value)}%`;
  if (key === 'collisionRatePer10s') return `${formatNumber(value)}/10s`;
  if (key === 'medianResponseMs') return `${formatNumber(value)} ms`;
  return formatNumber(value);
};

const deltaDisplay = (key, value) => {
  if (value === null) return 'Unavailable';
  if (key === 'accuracyPercent') return formatSigned(value, ' pt');
  if (key === 'collisionRatePer10s') return formatSigned(value, '/10s');
  if (key === 'medianResponseMs') return formatSigned(value, ' ms');
  return formatSigned(value);
};

const makeHeadline = (key, before, after, delta) => {
  if (key === 'score') return `Score: ${before} to ${after} (${delta}).`;
  if (key === 'accuracyPercent') return `Accuracy: ${before} to ${after} (${delta}).`;
  if (key === 'collisionRatePer10s') return `Collision rate: ${before} to ${after} (${delta}).`;
  return `Collect time: ${before} to ${after} (${delta}).`;
};

export function deriveEvidence(evidence) {
  const errors = [];
  const baseline = evidence?.baselineMetrics ?? {};
  const adapted = evidence?.adaptedMetrics ?? {};

  for (const key of METRIC_KEYS) {
    validateMetric(baseline[key], key, 'baselineMetrics', errors);
    validateMetric(adapted[key], key, 'adaptedMetrics', errors);
  }

  if (!isResolvedText(evidence?.baselineTrialId, { max: 100 })
      || !/^trial-[a-z0-9-]{8,}$/i.test(evidence?.baselineTrialId ?? '')) {
    errors.push('baselineTrialId must be a played trial-* identifier');
  }
  if (!isResolvedText(evidence?.adaptedTrialId, { max: 100 })
      || !/^trial-[a-z0-9-]{8,}$/i.test(evidence?.adaptedTrialId ?? '')) {
    errors.push('adaptedTrialId must be a played trial-* identifier');
  }
  if (isResolvedText(evidence?.baselineTrialId, { max: 100 })
      && isResolvedText(evidence?.adaptedTrialId, { max: 100 })
      && evidence.baselineTrialId === evidence.adaptedTrialId) {
    errors.push('Baseline and adapted trial IDs must differ');
  }

  const playerCheckIn = typeof evidence?.playerCheckIn === 'string'
    ? evidence.playerCheckIn.trim().toLowerCase()
    : evidence?.playerCheckIn;
  if (!CHECK_INS.includes(playerCheckIn)) errors.push(`playerCheckIn must be one of: ${CHECK_INS.join(', ')}`);

  const verdict = typeof evidence?.verdict === 'string' ? evidence.verdict.trim() : evidence?.verdict;
  if (!VERDICTS.includes(verdict)) errors.push(`verdict must be one of: ${VERDICTS.join(', ')}`);

  for (const [field, label, max] of [
    ['selectedNeed', 'selectedNeed', 100],
    ['challengePreserved', 'challengePreserved', 140],
    ['interactionPathTested', 'interactionPathTested', 180],
  ]) {
    if (!isResolvedText(evidence?.[field], { max })) errors.push(`${label} must be resolved single-line text`);
  }

  if (!METRIC_KEYS.includes(evidence?.headlineMetric)) {
    errors.push(`headlineMetric must be one of: ${METRIC_KEYS.join(', ')}`);
  }
  if (playerCheckIn === 'skipped') {
    if (evidence?.playerObservation !== null) {
      errors.push('playerObservation must be null when the player check-in was skipped');
    }
  } else if (CHECK_INS.includes(playerCheckIn)
      && !isResolvedText(evidence?.playerObservation, { max: 240 })) {
    errors.push('playerObservation is required for an answered check-in');
  }

  const audioStatus = evidence?.audioEvidence?.status;
  if (!['human_confirmed', 'instrumented_only', 'not_tested'].includes(audioStatus)) {
    errors.push('audioEvidence.status must be human_confirmed, instrumented_only, or not_tested');
  }
  if (audioStatus !== 'not_tested'
      && !isResolvedText(evidence?.audioEvidence?.observation, { max: 240 })) {
    errors.push('audioEvidence.observation is required for confirmed or instrumented audio');
  }
  if (audioStatus === 'not_tested' && evidence?.audioEvidence?.observation !== null
      && !isResolvedText(evidence?.audioEvidence?.observation, { max: 240 })) {
    errors.push('audioEvidence.observation must be null or resolved single-line text');
  }

  if (errors.length) return { errors };

  const deltas = {
    scoreDelta: adapted.score - baseline.score,
    accuracyDeltaPoints: adapted.accuracyPercent - baseline.accuracyPercent,
    collisionRateDeltaPer10s: round(adapted.collisionRatePer10s - baseline.collisionRatePer10s),
    medianResponseDeltaMs: baseline.medianResponseMs === null || adapted.medianResponseMs === null
      ? null
      : adapted.medianResponseMs - baseline.medianResponseMs,
  };
  const expectedVerdict = expectedVerdictFor({ playerCheckIn, ...deltas });
  if (verdict !== expectedVerdict) {
    errors.push(`Verdict mismatch: expected ${expectedVerdict}, received ${verdict}`);
  }
  if (evidence.headlineMetric === 'medianResponseMs' && deltas.medianResponseDeltaMs === null) {
    errors.push('headlineMetric cannot use medianResponseMs when the paired delta is unavailable');
  }
  if (errors.length) return { errors };

  const metricRows = METRIC_KEYS.map((key) => {
    const deltaKey = {
      score: 'scoreDelta',
      accuracyPercent: 'accuracyDeltaPoints',
      collisionRatePer10s: 'collisionRateDeltaPer10s',
      medianResponseMs: 'medianResponseDeltaMs',
    }[key];
    return {
      key,
      label: metricLabels[key],
      before: metricDisplay(key, baseline[key]),
      after: metricDisplay(key, adapted[key]),
      delta: deltaDisplay(key, deltas[deltaKey]),
    };
  });
  const headline = metricRows.find((row) => row.key === evidence.headlineMetric);
  const headlineSentence = makeHeadline(headline.key, headline.before, headline.after, headline.delta);
  const playerObservation = playerCheckIn === 'skipped'
    ? 'The player skipped the check-in; no subjective outcome was recorded.'
    : evidence.playerObservation.trim();
  const audioObservation = evidence.audioEvidence.observation?.trim()
    ?? 'No person confirmed audible output.';

  return {
    errors,
    playerCheckIn,
    verdict,
    verdictLabel: verdictLabels[verdict],
    verdictSentence: verdictSentences[verdict],
    deltas,
    metricRows,
    headlineSentence,
    playerObservation,
    audioObservation,
  };
}

const requireReleaseText = (value, label, errors, max = 240) => {
  if (!isResolvedText(value, { max })) errors.push(`${label} must be resolved single-line text`);
};

export function validatePackRelease(release, { allowPreview = false } = {}) {
  const errors = [];
  if (!allowPreview && (
    release?._previewOnly === true
    || release?.project?.name === 'FINAL PROJECT NAME'
    || release?.artifacts?.releaseTag === 'submission-preview'
    || /^0{40}$/.test(release?.artifacts?.applicationCommit ?? '')
    || /^trial-preview-/i.test(release?.humanEvidence?.baselineTrialId ?? '')
    || /^trial-preview-/i.test(release?.humanEvidence?.adaptedTrialId ?? '')
    || /PREVIEW ONLY/i.test(JSON.stringify(release ?? {}))
  )) {
    errors.push('Release contains preview-only sentinel values');
  }
  if (release?.schemaVersion !== 2) errors.push('schemaVersion must be 2');
  requireReleaseText(release?.project?.name, 'project.name', errors, 42);
  requireReleaseText(release?.project?.tagline, 'project.tagline', errors, 100);
  requireReleaseText(release?.artifacts?.liveUrl, 'artifacts.liveUrl', errors, 500);
  requireReleaseText(release?.artifacts?.repositoryUrl, 'artifacts.repositoryUrl', errors, 500);
  requireReleaseText(release?.artifacts?.releaseTag, 'artifacts.releaseTag', errors, 100);
  requireReleaseText(release?.artifacts?.applicationCommit, 'artifacts.applicationCommit', errors, 40);
  requireReleaseText(release?.artifacts?.videoUrl, 'artifacts.videoUrl', errors, 500);
  if (release?.artifacts?.devpostUrl !== null && release?.artifacts?.devpostUrl !== undefined) {
    if (!isResolvedText(release.artifacts.devpostUrl, { max: 500 })) {
      errors.push('artifacts.devpostUrl must be null or a resolved HTTPS Devpost URL');
    } else {
      try {
        const devpostUrl = new URL(release.artifacts.devpostUrl);
        const hostname = devpostUrl.hostname.toLowerCase();
        if (devpostUrl.protocol !== 'https:' || devpostUrl.username || devpostUrl.password
            || (hostname !== 'devpost.com' && !hostname.endsWith('.devpost.com'))) {
          errors.push('artifacts.devpostUrl must be null or a resolved HTTPS Devpost URL');
        }
      } catch {
        errors.push('artifacts.devpostUrl must be null or a resolved HTTPS Devpost URL');
      }
    }
  }
  if (!Number.isFinite(release?.artifacts?.videoRuntimeSeconds)
      || release.artifacts.videoRuntimeSeconds <= 0 || release.artifacts.videoRuntimeSeconds >= 180) {
    errors.push('artifacts.videoRuntimeSeconds must be greater than 0 and under 180');
  }
  if (!Number.isInteger(release?.artifacts?.sitesVersion) || release.artifacts.sitesVersion < 1) {
    errors.push('artifacts.sitesVersion must be a positive integer');
  }
  if (!Number.isInteger(release?.buildEvidence?.productTestCount)
      || release.buildEvidence.productTestCount < 1) {
    errors.push('buildEvidence.productTestCount must be a positive integer');
  }
  for (const key of [
    'lintPassed',
    'typecheckPassed',
    'productTestsPassed',
    'productionBuildPassed',
    'releaseHeadersPassed',
    'productionLifecyclePassed',
  ]) {
    if (release?.buildEvidence?.[key] !== true) errors.push(`buildEvidence.${key} must be true`);
  }
  const evidence = deriveEvidence(release?.humanEvidence);
  errors.push(...evidence.errors);
  return { errors, evidence };
}

export function makePreviewRelease(release = {}) {
  return {
    ...release,
    _previewOnly: true,
    schemaVersion: 2,
    project: {
      name: 'FINAL PROJECT NAME',
      tagline: release.project?.tagline ?? 'Your approval changes what the agent can do.',
    },
    artifacts: {
      ...release.artifacts,
      liveUrl: 'https://example.com/live-app',
      repositoryUrl: 'https://github.com/example/project',
      releaseTag: 'submission-preview',
      applicationCommit: '0000000000000000000000000000000000000000',
      videoUrl: 'https://youtu.be/preview00000',
      videoRuntimeSeconds: 119,
      sitesVersion: release.artifacts?.sitesVersion ?? 10,
      devpostUrl: null,
    },
    humanEvidence: {
      baselineTrialId: 'trial-preview-baseline',
      adaptedTrialId: 'trial-preview-adapted',
      playerCheckIn: 'skipped',
      verdict: 'objective_only',
      selectedNeed: 'a fictional one-hand-play need',
      challengePreserved: 'the fixed target course',
      interactionPathTested: 'fictional preview data on the fixed course',
      headlineMetric: 'accuracyPercent',
      baselineMetrics: {
        score: 300,
        accuracyPercent: 70,
        collisionRatePer10s: 1.5,
        medianResponseMs: 1200,
      },
      adaptedMetrics: {
        score: 400,
        accuracyPercent: 80,
        collisionRatePer10s: 1,
        medianResponseMs: 900,
      },
      playerObservation: null,
      audioEvidence: {
        status: 'not_tested',
        observation: 'PREVIEW ONLY — no human audio evidence is asserted.',
      },
    },
    buildEvidence: {
      productTestCount: release.buildEvidence?.productTestCount ?? 52,
      lintPassed: true,
      typecheckPassed: true,
      productTestsPassed: true,
      productionBuildPassed: true,
      releaseHeadersPassed: true,
      productionLifecyclePassed: true,
    },
  };
}

export const formatMetricTable = (metricRows) => metricRows
  .map((row) => `- ${row.label}: ${row.before} → ${row.after} (${row.delta})`)
  .join('\n');

export const checkInLabel = (value) => ({
  better: 'Better for me',
  same: 'About the same',
  worse: 'Worse for me',
  skipped: 'Skipped',
}[value]);
