import {
  DEFAULT_SETTINGS,
  PLAY_COURSE,
  PLAY_COURSE_ID,
  calculateTrialScore,
  createSampleBaseline,
  sanitizeTuneChanges,
} from './core.mjs';
import { settingsFingerprint } from './webmcp-contract.mjs';

export const LAB_STATE_VERSION = 3;
export const LAB_STORAGE_KEY = 'second-player-lab';
export const ALLOWED_NEED_IDS = Object.freeze([
  'one-hand',
  'fine-motor',
  'motion',
  'contrast',
  'response',
]);

const DEFAULT_NEEDS = Object.freeze(['one-hand', 'motion']);
const SETTING_KEYS = Object.freeze(Object.keys(DEFAULT_SETTINGS));
const MAX_SESSION_AGE_MS = 1000 * 60 * 60 * 24 * 365;
const MAX_TRIAL_DURATION_MS = 20000;
const TARGET_COUNT = PLAY_COURSE.targets.length;
const DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right']);
const INTEGER_SESSION_FIELDS = new Set([
  'collected',
  'expired',
  'collisions',
  'inputCount',
  'directionChanges',
  'pathDistance',
  'score',
]);
const SAMPLE_BASELINE = createSampleBaseline(DEFAULT_SETTINGS);
const SAMPLE_NUMERIC_FIELDS = Object.freeze([
  'durationMs',
  'collected',
  'expired',
  'collisions',
  'idleMs',
  'inputCount',
  'directionChanges',
  'pathDistance',
  'score',
]);

const isPlainObject = (value) => Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value);

const finiteInRange = (value, min, max) => (
  typeof value === 'number'
  && Number.isFinite(value)
  && value >= min
  && value <= max
);

export function normalizeSettings(value) {
  if (!isPlainObject(value)) throw new Error('settings must be an object');
  const unknown = Object.keys(value).filter((key) => !SETTING_KEYS.includes(key));
  if (unknown.length) throw new Error(`unsupported settings: ${unknown.join(', ')}`);
  const candidate = { ...DEFAULT_SETTINGS, ...value };
  const clean = sanitizeTuneChanges(candidate);
  return { ...DEFAULT_SETTINGS, ...clean };
}

const normalizeCounts = (value) => {
  if (!isPlainObject(value)) throw new Error('directionCounts must be an object');
  const unknown = Object.keys(value).filter((direction) => !DIRECTIONS.includes(direction));
  if (unknown.length) throw new Error(`unsupported direction counts: ${unknown.join(', ')}`);
  const result = {};
  for (const direction of DIRECTIONS) {
    if (!finiteInRange(value[direction], 0, 10000) || !Number.isInteger(value[direction])) {
      throw new Error(`invalid ${direction} count`);
    }
    result[direction] = value[direction];
  }
  return result;
};

const assertCanonicalSample = (value, numbers, directionCounts, reactionTimesMs) => {
  if (value.id !== SAMPLE_BASELINE.id) throw new Error('invalid sample session id');
  for (const key of SAMPLE_NUMERIC_FIELDS) {
    if (numbers[key] !== SAMPLE_BASELINE[key]) throw new Error(`invalid sample ${key}`);
  }
  for (const direction of DIRECTIONS) {
    if (directionCounts[direction] !== SAMPLE_BASELINE.directionCounts[direction]) {
      throw new Error(`invalid sample ${direction} count`);
    }
  }
  if (
    reactionTimesMs.length !== SAMPLE_BASELINE.reactionTimesMs.length
    || reactionTimesMs.some((entry, index) => entry !== SAMPLE_BASELINE.reactionTimesMs[index])
  ) {
    throw new Error('invalid sample reaction times');
  }
};

export function normalizeBaselineSession(value) {
  if (!isPlainObject(value) || value.mode !== 'baseline') throw new Error('only baseline sessions can be restored');
  if (typeof value.id !== 'string' || value.id.length < 1 || value.id.length > 128) throw new Error('invalid session id');
  if (!['played', 'sample'].includes(value.source)) throw new Error('invalid session source');
  if (value.courseId !== PLAY_COURSE_ID) throw new Error('invalid session course');
  if (value.playerCheckIn != null) throw new Error('baseline cannot carry a player check-in');
  const createdAtMs = Date.parse(value.createdAt);
  if (!Number.isFinite(createdAtMs) || Math.abs(Date.now() - createdAtMs) > MAX_SESSION_AGE_MS) {
    throw new Error('invalid session timestamp');
  }
  const settingsSnapshot = normalizeSettings(value.settingsSnapshot);
  const numericRules = {
    durationMs: [1, MAX_TRIAL_DURATION_MS],
    collected: [0, TARGET_COUNT],
    expired: [0, TARGET_COUNT],
    collisions: [0, 64],
    idleMs: [0, MAX_TRIAL_DURATION_MS],
    inputCount: [0, 10000],
    directionChanges: [0, 10000],
    pathDistance: [0, 15000],
    score: [0, TARGET_COUNT * 250],
  };
  const numbers = {};
  for (const [key, [min, max]] of Object.entries(numericRules)) {
    if (!finiteInRange(value[key], min, max)) throw new Error(`invalid ${key}`);
    if (INTEGER_SESSION_FIELDS.has(key) && !Number.isInteger(value[key])) {
      throw new Error(`invalid ${key}`);
    }
    numbers[key] = value[key];
  }
  if (!Array.isArray(value.reactionTimesMs) || value.reactionTimesMs.length > TARGET_COUNT) {
    throw new Error('invalid reaction times');
  }
  const reactionTimesMs = value.reactionTimesMs.map((entry) => {
    if (!finiteInRange(entry, 0, MAX_TRIAL_DURATION_MS)) throw new Error('invalid reaction time');
    return entry;
  });
  const directionCounts = normalizeCounts(value.directionCounts);
  const directionTotal = Object.values(directionCounts).reduce((total, count) => total + count, 0);

  if (numbers.collected + numbers.expired !== TARGET_COUNT) throw new Error('trial target totals do not match the course');
  if (numbers.idleMs > numbers.durationMs) throw new Error('idle time exceeds trial duration');
  if (reactionTimesMs.length !== numbers.collected) throw new Error('reaction count does not match collected targets');
  if (reactionTimesMs.some((entry) => entry > numbers.durationMs)) throw new Error('reaction time exceeds trial duration');
  if (directionTotal !== numbers.inputCount) throw new Error('direction counts do not match input count');
  if (numbers.directionChanges > Math.max(0, numbers.inputCount - 1)) {
    throw new Error('direction changes exceed input transitions');
  }

  if (value.source === 'sample') {
    assertCanonicalSample(value, numbers, directionCounts, reactionTimesMs);
  } else {
    if (!value.id.startsWith('trial-')) throw new Error('invalid played session id');
    if (numbers.durationMs < 250) throw new Error('played trial duration is implausibly short');
    const expectedScore = calculateTrialScore(numbers);
    if (numbers.score !== expectedScore) throw new Error('played trial score does not match telemetry');
    if (numbers.collisions > Math.ceil(numbers.durationMs / 800) + 1) {
      throw new Error('collision count exceeds the course cooldown');
    }
    if (numbers.pathDistance > numbers.durationMs * 0.6 + 100) {
      throw new Error('path distance exceeds the course movement bound');
    }
  }
  const fingerprint = settingsFingerprint(settingsSnapshot);
  if (value.settingsFingerprint !== undefined && value.settingsFingerprint !== fingerprint) {
    throw new Error('session settings fingerprint mismatch');
  }
  return {
    id: value.id,
    mode: 'baseline',
    createdAt: new Date(createdAtMs).toISOString(),
    ...numbers,
    directionCounts,
    reactionTimesMs,
    courseId: PLAY_COURSE_ID,
    settingsSnapshot,
    settingsFingerprint: fingerprint,
    baselineId: null,
    appliedProposalId: null,
    source: value.source,
  };
}

const defaultState = () => ({
  settings: { ...DEFAULT_SETTINGS },
  undoSettings: null,
  sessions: [],
  selectedNeeds: [...DEFAULT_NEEDS],
  recoveredFromInvalidState: false,
});

export function restorePersistedLab(rawText) {
  if (!rawText) return defaultState();
  try {
    const parsed = typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
    if (!isPlainObject(parsed)) throw new Error('saved state must be an object');
    if (parsed.version !== undefined && parsed.version !== LAB_STATE_VERSION) {
      throw new Error('unsupported saved-state version');
    }
    const settings = normalizeSettings(parsed.settings ?? DEFAULT_SETTINGS);
    const undoSettings = parsed.undoSettings == null ? null : normalizeSettings(parsed.undoSettings);
    const selectedNeeds = Array.isArray(parsed.selectedNeeds)
      ? [...new Set(parsed.selectedNeeds.filter((id) => ALLOWED_NEED_IDS.includes(id)))].slice(0, ALLOWED_NEED_IDS.length)
      : [...DEFAULT_NEEDS];
    const restoredBaselines = Array.isArray(parsed.sessions)
      ? parsed.sessions
          .filter((session) => session?.mode === 'baseline')
          .map((session) => normalizeBaselineSession(session))
          .slice(-1)
      : [];
    return {
      settings,
      undoSettings: undoSettings && settingsFingerprint(undoSettings) !== settingsFingerprint(settings)
        ? undoSettings
        : null,
      sessions: restoredBaselines,
      selectedNeeds: selectedNeeds.length ? selectedNeeds : [...DEFAULT_NEEDS],
      recoveredFromInvalidState: false,
    };
  } catch {
    return { ...defaultState(), recoveredFromInvalidState: true };
  }
}

export function serializePersistedLab({ settings, undoSettings, sessions, selectedNeeds }) {
  const safeSettings = normalizeSettings(settings);
  const safeUndo = undoSettings == null ? null : normalizeSettings(undoSettings);
  const baseline = [...sessions].reverse().find((session) => session?.mode === 'baseline');
  const safeSessions = baseline ? [normalizeBaselineSession(baseline)] : [];
  const safeNeeds = [...new Set(selectedNeeds.filter((id) => ALLOWED_NEED_IDS.includes(id)))];
  return JSON.stringify({
    version: LAB_STATE_VERSION,
    settings: safeSettings,
    undoSettings: safeUndo,
    sessions: safeSessions,
    selectedNeeds: safeNeeds.length ? safeNeeds : [...DEFAULT_NEEDS],
  });
}
