'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  DEFAULT_SETTINGS,
  PLAY_COURSE,
  PLAY_COURSE_ID,
  applyTune,
  calculateTrialScore,
  compareSessions,
  createSampleBaseline,
  deriveSignals,
  describeChanges,
  getComparisonReadiness,
  inputCodeForDirection,
  isPendingPlayedAdaptedSession,
  meaningfulTuneChanges,
  resolveModelContext,
  shouldAccumulateIdle,
} from './core.mjs';
import {
  createApplyTool,
  createBaseTools,
  createCompareTool,
  createToolExecutionTracker,
  createUndoTool,
  getDiscoverableToolNames,
  registerToolOnce,
  registerToolSet,
  settingsFingerprint,
} from './webmcp-contract.mjs';
import {
  LAB_STORAGE_KEY,
  restorePersistedLab,
  serializePersistedLab,
} from './persistence.mjs';
import {
  assertProposalSlotOpen,
  assertMutationAllowed,
  captureTrialLineage,
  capturedLineageIsValid,
  closeTuneLineageForManualEdit,
  findLatestCompletedPair,
  findLatestBaseline,
  getExactAppliedLineage,
  getTrialPresentation,
  getProposalFreshness,
  getSelectedNeedsLockReason,
  proposalIntentIsCurrent,
  requireMatchingBaseline,
  selectedNeedsFingerprint,
} from './lab-lifecycle.mjs';
import { hazardPresentationFor } from './hazard-presentation.mjs';
import { VoiceGuide } from './voice-guide';

type ControlMode = 'two-hand' | 'one-hand-left' | 'one-hand-right' | 'single-switch';
type MotionMode = 'full' | 'reduced' | 'none';
type ContrastMode = 'standard' | 'high' | 'monochrome';
type PlayerCheckInOutcome = 'better' | 'same' | 'worse';
type PlayerCheckInChoice = PlayerCheckInOutcome | 'skip';
type PanelTab = 'plan' | 'signals' | 'tools';
type PlayerCheckIn = {
  status: 'answered' | 'skipped';
  outcome: PlayerCheckInOutcome | null;
  baselineId: string;
  capturedVia: 'visible_player_ui';
  recordedAt: string;
};

type Settings = {
  controlMode: ControlMode;
  motion: MotionMode;
  contrast: ContrastMode;
  gameSpeed: number;
  targetScale: number;
  steeringAssist: number;
  collisionForgiveness: number;
  audioCues: boolean;
};

type TrialSession = {
  id: string;
  mode: 'baseline' | 'adapted';
  createdAt: string;
  durationMs: number;
  collected: number;
  expired: number;
  collisions: number;
  idleMs: number;
  inputCount: number;
  directionChanges: number;
  directionCounts: Record<'up' | 'down' | 'left' | 'right', number>;
  reactionTimesMs: number[];
  pathDistance: number;
  score: number;
  courseId: typeof PLAY_COURSE_ID;
  settingsSnapshot: Settings;
  settingsFingerprint?: string;
  baselineId?: string | null;
  appliedProposalId?: string | null;
  source: 'played' | 'sample';
  playerCheckIn?: PlayerCheckIn | null;
};

type TuneChange = Partial<Settings>;
type Proposal = {
  id: string;
  baselineId: string;
  baselineEvidenceGrade: 'played_trial' | 'fictional_sample';
  courseId: string;
  baseSettingsFingerprint: string;
  selectedNeeds: string[];
  selectedNeedsFingerprint: string;
  appliedSettingsFingerprint?: string;
  rationale: string;
  preserveChallenge: string;
  changes: TuneChange;
  diffs: Array<{ key: keyof Settings; label: string; from: Settings[keyof Settings]; to: Settings[keyof Settings] }>;
  status: 'pending' | 'approved' | 'applied' | 'declined';
  createdAt: string;
};

type Activity = {
  id: string;
  actor: 'player' | 'agent' | 'system';
  title: string;
  detail: string;
  at: string;
};

type Position = { x: number; y: number };
type Direction = 'up' | 'down' | 'left' | 'right';
type GamePhase = 'idle' | 'countdown' | 'playing' | 'complete';
type HazardImpact = { hazardId: string; sequence: number };

const TARGETS = PLAY_COURSE.targets;
const HAZARDS = PLAY_COURSE.hazards;

const NEEDS = [
  { id: 'one-hand', label: 'One-hand play' },
  { id: 'fine-motor', label: 'Lower precision' },
  { id: 'motion', label: 'Less motion' },
  { id: 'contrast', label: 'More contrast' },
  { id: 'response', label: 'More response time' },
];

const SWITCH_DIRECTIONS: Direction[] = ['right', 'down', 'left', 'up'];
const BASE_TOOL_SLOTS = [
  { name: 'inspect_play_lab', label: 'INSPECT' },
  { name: 'read_play_signals', label: 'SIGNALS' },
  { name: 'list_adaptations', label: 'ADAPT' },
  { name: 'propose_access_tune', label: 'PROPOSE' },
  { name: 'load_sample_baseline', label: 'SAMPLE' },
  { name: 'export_access_preset', label: 'EXPORT' },
] as const;
const TOOL_SLOT_LABELS: Record<string, string> = {
  ...Object.fromEntries(BASE_TOOL_SLOTS.map((slot) => [slot.name, slot.label])),
  apply_approved_tune: 'APPLY',
  compare_play_trials: 'COMPARE',
  undo_last_tune: 'UNDO',
};

const makeId = (prefix: string) =>
  `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;

const makeProposalId = () => {
  const token = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replaceAll('-', '').slice(0, 12)
    : Date.now().toString(36);
  return `plan-${token}`;
};

const nowLabel = () =>
  new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date());

const getModelContext = () => resolveModelContext(document.modelContext, () => navigator.modelContext);

const controlLabels: Record<ControlMode, string> = {
  'two-hand': 'Two-hand / flexible',
  'one-hand-left': 'Left-hand WASD',
  'one-hand-right': 'Right-hand arrows',
  'single-switch': 'Single-switch Space',
};

const motionLabels: Record<MotionMode, string> = {
  full: 'Full motion',
  reduced: 'Reduced motion',
  none: 'No decorative motion',
};

const contrastLabels: Record<ContrastMode, string> = {
  standard: 'Standard color',
  high: 'High contrast',
  monochrome: 'Shape + monochrome',
};

const playerCheckInLabels: Record<PlayerCheckInOutcome, string> = {
  better: 'Better for me',
  same: 'About the same',
  worse: 'Worse for me',
};
const playerCheckInChoices: PlayerCheckInChoice[] = ['better', 'same', 'worse', 'skip'];
const PANEL_TABS: PanelTab[] = ['plan', 'signals', 'tools'];

const preferredScrollBehavior = (motion: MotionMode): ScrollBehavior => {
  if (motion !== 'full') return 'auto';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'auto';
  return 'smooth';
};

function SettingValue({ settingKey, value }: { settingKey: keyof Settings; value: Settings[keyof Settings] }) {
  if (settingKey === 'controlMode') return controlLabels[value as ControlMode];
  if (settingKey === 'motion') return motionLabels[value as MotionMode];
  if (settingKey === 'contrast') return contrastLabels[value as ContrastMode];
  if (settingKey === 'gameSpeed') return `${Math.round((value as number) * 100)}% pace`;
  if (settingKey === 'targetScale') return `${Math.round((value as number) * 100)}% size`;
  if (settingKey === 'steeringAssist') return `${Math.round((value as number) * 100)}% assist`;
  if (settingKey === 'collisionForgiveness') return `${Math.round((value as number) * 100)}% forgiveness`;
  return value ? 'On' : 'Off';
}

function MiniMeter({ value, label, tone = 'mint' }: { value: number; label: string; tone?: 'mint' | 'yellow' | 'red' }) {
  return (
    <div className="mini-meter">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.09em] text-[#a7b2c6]">
        <span>{label}</span><span className="font-mono text-white">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full meter-${tone}`} style={{ width: `${Math.max(3, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function PlayerCheckInPanel({
  checkIn,
  onSelect,
}: {
  checkIn: PlayerCheckIn | null;
  onSelect: (choice: PlayerCheckInChoice) => void;
}) {
  const current = checkIn?.status === 'answered' ? checkIn.outcome : checkIn?.status === 'skipped' ? 'skip' : null;
  const moveChoice = (event: ReactKeyboardEvent<HTMLInputElement>, choice: PlayerCheckInChoice) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    if (event.repeat) return;
    const offset = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const index = playerCheckInChoices.indexOf(choice);
    const nextChoice = playerCheckInChoices[(index + offset + playerCheckInChoices.length) % playerCheckInChoices.length];
    const fieldset = event.currentTarget.closest('fieldset');
    onSelect(nextChoice);
    window.requestAnimationFrame(() => {
      fieldset
        ?.querySelector<HTMLInputElement>(`input[value="${nextChoice}"]`)
        ?.focus({ preventScroll: true });
    });
  };
  return (
    <fieldset
      className="player-check-in"
      id="player-check-in"
      tabIndex={-1}
      aria-describedby="player-check-in-note"
    >
      <legend id="player-check-in-title">Compared with your baseline, how did this setup work for you?</legend>
      <div className="player-check-in-meta">
        <p className="eyebrow text-[#f2c94c]">Player checkpoint</p>
        <span>No site tool can answer</span>
      </div>
      <div className="player-check-in-options">
        {(Object.keys(playerCheckInLabels) as PlayerCheckInOutcome[]).map((choice) => (
          <label
            key={choice}
            className={current === choice ? `is-selected choice-${choice}` : ''}
          >
            <input
              type="radio"
              name="player-check-in"
              value={choice}
              checked={current === choice}
              onChange={() => onSelect(choice)}
              onKeyDown={(event) => moveChoice(event, choice)}
            />
            <span>{playerCheckInLabels[choice]}</span>
            <span className="choice-marker" aria-hidden="true">{current === choice ? '✓' : '○'}</span>
          </label>
        ))}
        <label className={current === 'skip' ? 'is-selected' : ''}>
          <input
            type="radio"
            name="player-check-in"
            value="skip"
            checked={current === 'skip'}
            onChange={() => onSelect('skip')}
            onKeyDown={(event) => moveChoice(event, 'skip')}
          />
          <span>Skip</span>
          <span className="choice-marker" aria-hidden="true">{current === 'skip' ? '✓' : '○'}</span>
        </label>
      </div>
      <p className="player-check-in-note" id="player-check-in-note" role="status" aria-live="polite">
        {current
          ? 'Choice recorded. The paired comparison capability is registering; the live gate confirms when it is real.'
          : 'Paired deltas and the verdict stay locked until you answer or skip.'}
      </p>
    </fieldset>
  );
}

function TouchDirectionButton({
  direction,
  disabled,
  onDirectionChange,
}: {
  direction: Direction;
  disabled: boolean;
  onDirectionChange: (direction: Direction, pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Move ${direction}`}
      disabled={disabled}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onDirectionChange(direction, true);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onDirectionChange(direction, false);
      }}
      onPointerCancel={() => onDirectionChange(direction, false)}
      onLostPointerCapture={() => onDirectionChange(direction, false)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onDirectionChange(direction, true);
      }}
      onKeyUp={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onDirectionChange(direction, false);
      }}
      onBlur={() => onDirectionChange(direction, false)}
    >{({ left: '←', right: '→', up: '↑', down: '↓' } as const)[direction]}</button>
  );
}

function ArenaAtmosphere() {
  return (
    <div className="arena-atmosphere" aria-hidden="true">
      <svg className="course-lanes" viewBox="0 0 1000 560" preserveAspectRatio="none">
        <path className="course-lane course-lane-a" d="M-30 430 C145 430 165 128 365 128 S625 470 1030 242" />
        <path className="course-lane course-lane-b" d="M-40 500 C180 500 250 255 442 280 S692 535 1040 380" />
        <path className="course-lane course-lane-c" d="M160 590 C190 420 345 390 500 390 S780 315 842 -30" />
      </svg>
      <div className="arena-scan" />
      <div className="arena-horizon"><span /><span /><span /></div>
      <div className="arena-coordinate coordinate-a">SECTOR 04</div>
      <div className="arena-coordinate coordinate-b">COURSE / ORBITAL-01</div>
    </div>
  );
}

export default function Home() {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS } as Settings);
  const [undoSettings, setUndoSettings] = useState<Settings | null>(null);
  const [sessions, setSessions] = useState<TrialSession[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>(['one-hand', 'motion']);
  const [activity, setActivity] = useState<Activity[]>([
    { id: 'welcome', actor: 'system', title: 'Lab ready', detail: 'Play a baseline or load the transparent sample run.', at: 'now' },
  ]);
  const [webMcpStatus, setWebMcpStatus] = useState<'checking' | 'ready' | 'unavailable' | 'error'>('checking');
  const [registeredToolNames, setRegisteredToolNames] = useState<string[]>([]);
  const [baseRegistrationRevision, setBaseRegistrationRevision] = useState(0);
  const [applyRegistrationRevision, setApplyRegistrationRevision] = useState(0);
  const [compareRegistrationRevision, setCompareRegistrationRevision] = useState(0);
  const [undoRegistrationRevision, setUndoRegistrationRevision] = useState(0);
  const [failedCapabilityRegistrations, setFailedCapabilityRegistrations] = useState<string[]>([]);
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(20);
  const [player, setPlayer] = useState<Position>({ x: 50, y: 72 });
  const [activeTarget, setActiveTarget] = useState(0);
  const [collected, setCollected] = useState(0);
  const [collisions, setCollisions] = useState(0);
  const [score, setScore] = useState(0);
  const [switchDirection, setSwitchDirection] = useState<Direction>(SWITCH_DIRECTIONS[0]);
  const [collisionFlash, setCollisionFlash] = useState(false);
  const [hazardImpact, setHazardImpact] = useState<HazardImpact | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>('plan');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [needsExpanded, setNeedsExpanded] = useState(false);
  const [voiceResetRevision, setVoiceResetRevision] = useState(0);

  const settingsRef = useRef(settings);
  const undoSettingsRef = useRef(undoSettings);
  const sessionsRef = useRef(sessions);
  const proposalRef = useRef(proposal);
  const selectedNeedsRef = useRef(selectedNeeds);
  const phaseRef = useRef<GamePhase>(phase);
  const actionsRef = useRef<Record<string, (...args: never[]) => unknown>>({});
  const inputRef = useRef(new Set<string>());
  const playerRef = useRef<Position>(player);
  const switchDirectionRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hazardImpactTimeoutRef = useRef<number | null>(null);
  const settingsDialogRef = useRef<HTMLElement | null>(null);
  const settingsReturnFocusRef = useRef<HTMLElement | null>(null);
  const relayPromptRef = useRef<HTMLTextAreaElement | null>(null);
  const sessionRef = useRef<null | {
    id: string;
    mode: 'baseline' | 'adapted';
    startedAt: number;
    lastFrameAt: number;
    targetShownAt: number;
    collected: number;
    expired: number;
    collisions: number;
    idleMs: number;
    inputCount: number;
    directionChanges: number;
    directionCounts: Record<Direction, number>;
    reactionTimesMs: number[];
    pathDistance: number;
    lastDirection: Direction | null;
    lastCollisionAt: number;
    targetIndex: number;
    courseId: typeof PLAY_COURSE_ID;
    settingsSnapshot: Settings;
    settingsFingerprint: string;
    baselineId: string | null;
    appliedProposalId: string | null;
  }>(null);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { undoSettingsRef.current = undoSettings; }, [undoSettings]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { proposalRef.current = proposal; }, [proposal]);
  useEffect(() => { selectedNeedsRef.current = selectedNeeds; }, [selectedNeeds]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { playerRef.current = player; }, [player]);

  const openSettings = useCallback(() => {
    settingsReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    window.requestAnimationFrame(() => {
      const returnTarget = settingsReturnFocusRef.current;
      if (returnTarget?.isConnected) returnTarget.focus();
      settingsReturnFocusRef.current = null;
    });
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const dialog = settingsDialogRef.current;
    if (!dialog) return;
    const focusableSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    (getFocusable()[0] ?? dialog).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettings();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1) as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', onKeyDown);
    return () => dialog.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen, closeSettings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(LAB_STORAGE_KEY);
      } catch {
        // Treat unavailable storage as an empty, safe lab.
      }
      const restored = restorePersistedLab(saved);
      const restoredSettings = restored.settings as Settings;
      const restoredUndo = restored.undoSettings as Settings | null;
      const restoredSessions = restored.sessions as TrialSession[];
      settingsRef.current = restoredSettings;
      undoSettingsRef.current = restoredUndo;
      sessionsRef.current = restoredSessions;
      selectedNeedsRef.current = restored.selectedNeeds;
      proposalRef.current = null;
      setSettings(restoredSettings);
      setUndoSettings(restoredUndo);
      setSessions(restoredSessions);
      setSelectedNeeds(restored.selectedNeeds);
      if (restored.recoveredFromInvalidState) {
        setActivity([{ id: 'recovered', actor: 'system', title: 'Saved state reset safely', detail: 'Invalid local data was discarded before site tools became available.', at: 'now' }]);
      } else if (restoredUndo) {
        setActivity([{ id: 'restored-undo', actor: 'system', title: 'Previous tune restored', detail: 'The active settings can still be undone; approval itself was not restored.', at: 'now' }]);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LAB_STORAGE_KEY, serializePersistedLab({ settings, undoSettings, sessions, selectedNeeds }));
    } catch {
      // Persistence is optional; runtime safety does not depend on localStorage.
    }
  }, [hydrated, settings, undoSettings, sessions, selectedNeeds]);

  const appendActivity = useCallback((actor: Activity['actor'], title: string, detail: string) => {
    if (actor === 'agent') setCopiedPrompt(null);
    setActivity((current) => [
      { id: makeId('activity'), actor, title, detail, at: nowLabel() },
      ...current,
    ].slice(0, 12));
  }, []);

  const logToolError = useCallback((name: string, error: unknown) => {
    const detail = error instanceof Error ? error.message : 'The request was rejected without changing state.';
    appendActivity('agent', `${name} rejected`, detail.slice(0, 180));
  }, [appendActivity]);

  const retryBaseRegistration = useCallback(() => {
    setWebMcpStatus('checking');
    setBaseRegistrationRevision((revision) => revision + 1);
    appendActivity('system', 'Base tool registration retrying', 'The page state stayed intact while the live contract reconnects.');
  }, [appendActivity]);

  const retryCapabilityRegistration = useCallback((toolNames: string[]) => {
    if (toolNames.includes('apply_approved_tune')) setApplyRegistrationRevision((revision) => revision + 1);
    if (toolNames.includes('compare_play_trials')) setCompareRegistrationRevision((revision) => revision + 1);
    if (toolNames.includes('undo_last_tune')) setUndoRegistrationRevision((revision) => revision + 1);
    setFailedCapabilityRegistrations((current) => current.filter((name) => !toolNames.includes(name)));
    appendActivity('system', 'Gated capability retrying', 'The approved plan and completed evidence stayed intact.');
  }, [appendActivity]);

  const assertLabMutable = useCallback((action: string) => {
    assertMutationAllowed(phaseRef.current, action);
  }, []);

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    if (phaseRef.current === 'countdown' || phaseRef.current === 'playing') {
      appendActivity('system', 'Settings locked during trial', 'Finish the current run before changing its conditions.');
      return;
    }
    const next = { ...settingsRef.current, ...patch } as Settings;
    if (settingsFingerprint(next) === settingsFingerprint(settingsRef.current)) return;
    settingsRef.current = next;
    setSettings(next);

    const closed = closeTuneLineageForManualEdit({
      proposal: proposalRef.current,
      undoSettings: undoSettingsRef.current,
    });
    if (closed.lineageClosed) {
      proposalRef.current = closed.proposal;
      undoSettingsRef.current = closed.undoSettings;
      setProposal(closed.proposal);
      setUndoSettings(closed.undoSettings);
      appendActivity('player', 'Applied tune edited', 'The agent tune and its undo were closed before the manual setting became active. Completed comparison evidence stays visible.');
    }
  }, [appendActivity]);

  const toggleNeed = useCallback((needId: string) => {
    const lockReason = getSelectedNeedsLockReason({
      phase: phaseRef.current,
      proposalStatus: proposalRef.current?.status,
    });
    if (lockReason) {
      appendActivity('system', 'Player intent locked', lockReason);
      return;
    }
    const next = selectedNeedsRef.current.includes(needId)
      ? selectedNeedsRef.current.filter((id) => id !== needId)
      : [...selectedNeedsRef.current, needId];
    selectedNeedsRef.current = next;
    setSelectedNeeds(next);
    if (proposalRef.current && ['pending', 'approved'].includes(proposalRef.current.status)) {
      appendActivity('player', 'Plan needs fresh review', 'The player changed what play should respect, so the existing proposal cannot be approved or applied.');
    }
  }, [appendActivity]);

  const ensureAudioContext = useCallback(async () => {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      let context = audioContextRef.current;
      if (!context || context.state === 'closed') {
        context = new AudioContextClass();
        audioContextRef.current = context;
      }
      if (context.state === 'suspended') await context.resume();
      return context.state === 'running' ? context : null;
    } catch {
      return null;
    }
  }, []);

  const playTone = useCallback((frequency: number, duration = 0.08) => {
    if (!settingsRef.current.audioCues) return;
    const context = audioContextRef.current;
    if (!context || context.state === 'closed') return;
    const emit = () => {
      try {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        gain.gain.setValueAtTime(0.08, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + duration);
      } catch {
        // Audio remains optional if the browser revokes or suspends output.
      }
    };
    if (context.state === 'running') emit();
    else void context.resume().then(emit).catch(() => undefined);
  }, []);

  useEffect(() => () => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  }, []);

  useEffect(() => () => {
    if (hazardImpactTimeoutRef.current !== null) window.clearTimeout(hazardImpactTimeoutRef.current);
  }, []);

  const latestSession = sessions.at(-1) ?? null;
  const latestSignals = useMemo(() => latestSession ? deriveSignals(latestSession) : null, [latestSession]);
  const completedPair = findLatestCompletedPair(sessions) as {
    baseline: TrialSession;
    adapted: TrialSession;
    lineage: {
      baselineId: string;
      baselineSettingsFingerprint: string;
      proposalId: string;
      appliedSettingsFingerprint: string;
    };
  } | null;
  const baselineSession = (completedPair?.baseline ?? findLatestBaseline(sessions)) as TrialSession | null;
  const exactAppliedLineage = getExactAppliedLineage({ proposal, sessions, settings });
  const hasExactAppliedTune = Boolean(exactAppliedLineage);
  const adaptedSession = completedPair?.adapted ?? null;
  const comparisonReadiness = baselineSession && adaptedSession
    ? getComparisonReadiness(baselineSession, adaptedSession)
    : null;
  const comparisonReady = Boolean(comparisonReadiness?.comparisonReady);
  const comparison = baselineSession && adaptedSession && comparisonReady
    ? compareSessions(baselineSession, adaptedSession)
    : null;
  const baselineResultSignals = comparison && baselineSession ? deriveSignals(baselineSession) : null;
  const adaptedResultSignals = comparison && adaptedSession ? deriveSignals(adaptedSession) : null;
  const hasUndo = Boolean(undoSettings);
  const needsPanelOpen = !baselineSession || needsExpanded;

  const proposalFreshness = getProposalFreshness({ proposal, settings, selectedNeeds });
  const proposalIsStale = proposalFreshness.stale;
  const compareWasCalled = activity.some((item) => item.actor === 'agent' && item.title === 'compare_play_trials');
  const latestActivity = activity[0];
  const latestAgentActivity = activity.find((item) => item.actor === 'agent') ?? null;
  const applyIsRegistered = registeredToolNames.includes('apply_approved_tune');
  const compareIsRegistered = registeredToolNames.includes('compare_play_trials');
  const undoIsRegistered = registeredToolNames.includes('undo_last_tune');
  const applyRegistrationNeedsRetry = failedCapabilityRegistrations.includes('apply_approved_tune') || webMcpStatus === 'error';
  const agentRequest = (() => {
    if (!baselineSession) {
      return {
        canCopy: false,
        eyebrow: 'Step 1 · create evidence',
        instruction: 'Play the twenty-second baseline. Your run stays on this device until a site tool reads it.',
        buttonLabel: 'Play baseline first',
        prompt: '',
      };
    }
    if (!proposal || proposal.status === 'declined' || proposalIsStale) {
      return {
        canCopy: true,
        eyebrow: 'Baseline ready for WebMCP',
        instruction: 'Copy this request, paste it in the conversation beside this page, and press Send. Copying alone does not contact the agent.',
        buttonLabel: '1 · Copy request',
        prompt: 'Inspect my baseline and tune the game with the smallest reversible change that preserves the challenge.',
      };
    }
    if (proposal.status === 'pending') {
      return {
        canCopy: false,
        eyebrow: 'Agent plan received',
        instruction: 'Review the exact changes below. Apply is still absent until you approve this revision.',
        buttonLabel: 'Review exact plan',
        prompt: '',
      };
    }
    if (proposal.status === 'approved') {
      const approvalEyebrow = applyIsRegistered
        ? 'Apply is registered'
        : applyRegistrationNeedsRetry
          ? 'Approval safe · registration paused'
          : webMcpStatus === 'unavailable'
            ? 'Approval safe · WebMCP browser required'
            : 'Approval recorded · Apply registering';
      const approvalInstruction = applyIsRegistered
        ? 'Your click created one single-use capability. Ask the browser agent to use this exact revision.'
        : applyRegistrationNeedsRetry
          ? 'The exact approval is preserved. Retry the gated capability in the page without refreshing.'
          : webMcpStatus === 'unavailable'
            ? 'Open this page in ChatGPT or a WebMCP-enabled browser to create the live apply capability.'
            : 'The page is waiting for the live WebMCP registry to confirm the new capability.';
      return {
        canCopy: applyIsRegistered,
        eyebrow: approvalEyebrow,
        instruction: approvalInstruction,
        buttonLabel: applyIsRegistered
          ? 'Copy apply request'
          : applyRegistrationNeedsRetry
            ? 'Retry Apply registration'
            : webMcpStatus === 'unavailable'
              ? 'WebMCP browser required'
              : 'Waiting for Apply',
        prompt: `Apply the exact plan I approved: ${proposal.id}.`,
      };
    }
    if (!adaptedSession) {
      return {
        canCopy: false,
        eyebrow: 'Tune applied · undo protected',
        instruction: 'Apply has been removed and exact undo has replaced it. Play the same course again.',
        buttonLabel: 'Start adapted run',
        prompt: '',
      };
    }
    if (!comparisonReady) {
      return {
        canCopy: false,
        eyebrow: 'Agent is waiting on you',
        instruction: 'Complete the visible player check-in. No site tool can answer it for you.',
        buttonLabel: 'Complete player check-in',
        prompt: '',
      };
    }
    if (!compareWasCalled) {
      return {
        canCopy: compareIsRegistered,
        eyebrow: compareIsRegistered ? 'Comparison tool registered' : 'Check-in recorded · comparison registering',
        instruction: compareIsRegistered
          ? 'Your check-in created the paired-evidence capability. Ask for every gain and regression.'
          : 'The page is waiting for the live WebMCP registry to confirm the paired-evidence capability.',
        buttonLabel: compareIsRegistered ? 'Copy compare request' : 'Waiting for comparison tool',
        prompt: 'Compare my baseline and adapted trials. Report every improvement, regression, and evidence limitation.',
      };
    }
    if (hasUndo) {
      return {
        canCopy: undoIsRegistered,
        eyebrow: undoIsRegistered ? 'Evidence read · restore registered' : 'Evidence read · restore registering',
        instruction: undoIsRegistered
          ? 'The result stays visible. Ask the agent to restore your exact prior settings.'
          : 'The prior-settings snapshot is safe while its live restore capability registers.',
        buttonLabel: undoIsRegistered ? 'Copy undo request' : 'Waiting for restore tool',
        prompt: 'Undo the tune and verify that my exact prior settings were restored while keeping the evidence.',
      };
    }
    return {
      canCopy: false,
      eyebrow: 'Lifecycle complete',
      instruction: 'The prior settings are restored and the before-and-after evidence remains on this page.',
      buttonLabel: 'Evidence retained',
      prompt: '',
    };
  })();
  const agentRequestKey = [
    agentRequest.prompt,
    baselineSession?.id ?? 'no-baseline',
    proposal?.id ?? 'no-proposal',
    proposal?.status ?? 'none',
    adaptedSession?.id ?? 'no-adapted',
    comparisonReady ? 'comparison-ready' : 'comparison-closed',
  ].join('|');
  const copied = Boolean(agentRequest.prompt && copiedPrompt === agentRequestKey);

  const expectedToolNames = getDiscoverableToolNames({
    proposalStatus: proposal?.status,
    proposalStale: proposalIsStale,
    comparisonReady,
    hasUndo,
  });
  const toolNames = registeredToolNames;

  useEffect(() => {
    if (!comparisonReady) return;
    const frame = window.requestAnimationFrame(() => {
      const panel = document.querySelector('#copilot-panel');
      panel?.querySelector('.panel-scroll-region')?.scrollTo({ top: 0, behavior: 'auto' });
      panel?.querySelector('.panel-content')?.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [comparisonReady]);

  const inspectLab = useCallback(() => {
    const activeProposal = proposalRef.current;
    const latest = sessionsRef.current.at(-1);
    const latestMetricsWithheld = isPendingPlayedAdaptedSession(latest, sessionsRef.current);
    const latestReport = latest && !latestMetricsWithheld ? deriveSignals(latest) : null;
    const freshness = getProposalFreshness({
      proposal: activeProposal,
      settings: settingsRef.current,
      selectedNeeds: selectedNeedsRef.current,
    });
    const stale = freshness.stale;
    const completed = findLatestCompletedPair(sessionsRef.current);
    const matchedReadiness = completed
      ? getComparisonReadiness(completed.baseline, completed.adapted)
      : null;
    const hasMatchedAdapted = Boolean(completed);
    return {
      product: 'MCPilot Adaptive Interactive Play Lab',
      phase,
      selectedNeeds: selectedNeedsRef.current,
      activeSettings: settingsRef.current,
      latestSession: latestMetricsWithheld && latest ? {
        id: latest.id,
        mode: latest.mode,
        source: latest.source,
        courseId: latest.courseId,
        evidenceGrade: 'played_trial',
        playerCheckIn: null,
        metricsWithheld: true,
        withholdingReason: 'pending_visible_player_check_in',
      } : latestReport ? {
          id: latestReport.sessionId,
          mode: latestReport.mode,
          source: latest?.source,
          courseId: latestReport.courseId,
          evidenceGrade: latestReport.evidenceGrade,
          playerCheckIn: latestReport.playerCheckIn,
          metricsWithheld: false,
          score: latestReport.score,
          accuracyPercent: latestReport.accuracyPercent,
          signalCodes: latestReport.observations.map((item: { code: string }) => item.code),
        } : null,
      proposal: activeProposal ? {
        id: activeProposal.id,
        status: activeProposal.status,
        stale,
        baselineEvidenceGrade: activeProposal.baselineEvidenceGrade,
        courseId: activeProposal.courseId,
        selectedNeeds: activeProposal.selectedNeeds,
        changedSettings: activeProposal.diffs.map((item) => item.key),
      } : null,
      comparisonEvidence: matchedReadiness ? {
        evidenceGrade: matchedReadiness.evidenceGrade,
        claimableOutcome: matchedReadiness.claimableOutcome,
        playerCheckInStatus: matchedReadiness.playerCheckIn.status,
      } : null,
      nextHumanStep: matchedReadiness && !matchedReadiness.comparisonReady
        ? 'Wait for the visible experience check-in. No WebMCP site tool can submit that choice.'
        : matchedReadiness?.comparisonReady
          ? 'Compare the matched baseline and adapted trials.'
        : activeProposal?.status === 'approved' && stale
        ? 'Settings or player-selected needs changed. Clear this stale plan before creating a fresh proposal.'
        : activeProposal?.status === 'pending'
          ? 'The player must review the visible plan before it can be applied.'
          : activeProposal?.status === 'approved'
            ? 'The exact player-approved proposal is ready to apply.'
            : activeProposal?.status === 'applied' && !hasMatchedAdapted
              ? 'Invite the player to complete an adapted trial.'
              : sessionsRef.current.length === 0
                  ? 'Complete a baseline or explicitly load the sample baseline.'
                  : 'Use the evidence and selected needs to propose a narrow, reversible tune.',
    };
  }, [phase]);

  const loadSampleBaseline = useCallback((actor: Activity['actor'] = 'agent') => {
    assertLabMutable('Loading sample evidence');
    const existing = sessionsRef.current.find((item) => item.id === 'sample-baseline');
    if (existing) {
      setPanelTab('plan');
      return { status: 'already_loaded', sessionId: existing.id, signals: deriveSignals(existing) };
    }
    if (sessionsRef.current.length || proposalRef.current || undoSettingsRef.current) {
      throw new Error('STATE_CONFLICT: Reset the lab before loading the sample baseline. Existing evidence was preserved.');
    }
    const sample = {
      ...createSampleBaseline(settingsRef.current),
      settingsFingerprint: settingsFingerprint(settingsRef.current),
      baselineId: null,
      appliedProposalId: null,
    } as TrialSession;
    sessionsRef.current = [sample];
    setSessions([sample]);
    setPanelTab('plan');
    appendActivity(actor, 'Sample baseline loaded', 'Clearly labeled demo telemetry is ready for inspection.');
    return { status: 'loaded_sample_data', sessionId: sample.id, signals: deriveSignals(sample) };
  }, [appendActivity, assertLabMutable]);

  const proposeTune = useCallback((input: {
    changes?: TuneChange;
    rationale?: string;
    preserveChallenge?: string;
  }, actor: Activity['actor'] = 'agent') => {
    assertLabMutable('Creating a tune proposal');
    assertProposalSlotOpen(proposalRef.current);
    const { baseline, currentFingerprint } = requireMatchingBaseline(
      sessionsRef.current,
      settingsRef.current,
    );
    const rationale = String(input?.rationale ?? '').trim();
    const preserveChallenge = String(input?.preserveChallenge ?? '').trim();
    if (rationale.length < 12 || rationale.length > 420) {
      throw new Error('rationale must be between 12 and 420 characters');
    }
    if (preserveChallenge.length < 8 || preserveChallenge.length > 240) {
      throw new Error('preserveChallenge must be between 8 and 240 characters');
    }
    const changes = meaningfulTuneChanges(settingsRef.current, input.changes ?? {}) as TuneChange;
    const diffs = describeChanges(settingsRef.current, changes) as Proposal['diffs'];
    const next: Proposal = {
      id: makeProposalId(),
      baselineId: baseline.id,
      baselineEvidenceGrade: baseline.source === 'played' ? 'played_trial' : 'fictional_sample',
      courseId: baseline.courseId,
      baseSettingsFingerprint: currentFingerprint,
      selectedNeeds: [...selectedNeedsRef.current],
      selectedNeedsFingerprint: selectedNeedsFingerprint(selectedNeedsRef.current),
      rationale,
      preserveChallenge,
      changes,
      diffs,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    proposalRef.current = next;
    setProposal(next);
    setPanelTab('plan');
    appendActivity(actor, 'Tune proposed', `${diffs.length} reversible changes are waiting for player review.`);
    window.requestAnimationFrame(() => {
      const panel = document.querySelector('#copilot-panel');
      panel?.querySelector('.panel-scroll-region')?.scrollTo({ top: 0, behavior: 'auto' });
      panel?.querySelector('.panel-content')?.scrollTo({ top: 0, behavior: 'auto' });
      panel?.scrollIntoView({
        behavior: preferredScrollBehavior(settingsRef.current.motion),
        block: 'start',
      });
    });
    return {
      status: 'awaiting_player_approval',
      proposalId: next.id,
      baselineEvidenceGrade: next.baselineEvidenceGrade,
      courseId: next.courseId,
      changes: diffs,
      instruction: 'Do not claim the tune is active. The player must approve it in the visible page.',
    };
  }, [appendActivity, assertLabMutable]);

  const approveProposal = useCallback(() => {
    assertLabMutable('Approving a tune proposal');
    const current = proposalRef.current;
    if (!current || current.status !== 'pending') return;
    const freshness = getProposalFreshness({
      proposal: current,
      settings: settingsRef.current,
      selectedNeeds: selectedNeedsRef.current,
    });
    if (freshness.stale) {
      appendActivity('system', 'Plan is stale', 'Settings or player-selected needs changed after this plan was created. Ask for a fresh proposal.');
      return;
    }
    const approved = { ...current, status: 'approved' as const };
    proposalRef.current = approved;
    setProposal(approved);
    appendActivity('player', 'Plan approved', 'The exact apply capability is registering; the live receipt confirms when it becomes real.');
  }, [appendActivity, assertLabMutable]);

  const declineProposal = useCallback(() => {
    assertLabMutable('Declining a tune proposal');
    const current = proposalRef.current;
    if (!current || current.status !== 'pending') return;
    const declined = { ...current, status: 'declined' as const };
    proposalRef.current = declined;
    setProposal(declined);
    appendActivity('player', 'Plan declined', 'No settings changed and no apply tool became available.');
  }, [appendActivity, assertLabMutable]);

  const clearProposal = useCallback(() => {
    assertLabMutable('Clearing a tune proposal');
    proposalRef.current = null;
    setProposal(null);
  }, [assertLabMutable]);

  const applyApprovedTune = useCallback((proposalId: string, actor: Activity['actor'] = 'agent') => {
    assertLabMutable('Applying a tune');
    const current = proposalRef.current;
    if (!current || current.status !== 'approved') {
      throw new Error('STATE_CONFLICT: No player-approved plan is ready. Wait for visible player approval.');
    }
    if (proposalId !== current.id) {
      throw new Error('STALE_PROPOSAL: proposalId does not match the current approved plan.');
    }
    const freshness = getProposalFreshness({
      proposal: current,
      settings: settingsRef.current,
      selectedNeeds: selectedNeedsRef.current,
    });
    if (freshness.stale) {
      throw new Error('STALE_PROPOSAL: Settings or player-selected needs changed after approval. Create a fresh proposal.');
    }
    const baseline = findLatestBaseline(sessionsRef.current);
    if (
      !baseline
      || baseline.id !== current.baselineId
      || baseline.settingsFingerprint !== current.baseSettingsFingerprint
    ) {
      throw new Error('STALE_PROPOSAL: The approved plan no longer matches the available baseline.');
    }
    const before = { ...settingsRef.current } as Settings;
    const next = applyTune(before, current.changes) as Settings;
    const applied = {
      ...current,
      status: 'applied' as const,
      appliedSettingsFingerprint: settingsFingerprint(next),
    };
    proposalRef.current = applied;
    undoSettingsRef.current = before;
    settingsRef.current = next;
    setUndoSettings(before);
    setSettings(next);
    const retainedSessions = sessionsRef.current.filter((item) => item.mode !== 'adapted');
    sessionsRef.current = retainedSessions;
    setSessions(retainedSessions);
    setProposal(applied);
    setPanelTab('plan');
    appendActivity(actor, 'Approved tune applied', `${current.diffs.length} settings changed; the previous preset can be restored.`);
    return {
      status: 'applied',
      proposalId: current.id,
      activeSettings: next,
      verification: 'The visible game settings and trial controls now use this preset.',
      nextHumanStep: 'Invite the player to start an adapted trial when ready.',
    };
  }, [appendActivity, assertLabMutable]);

  const undoTune = useCallback((actor: Activity['actor'] = 'agent') => {
    assertLabMutable('Undoing a tune');
    const previous = undoSettingsRef.current;
    if (!previous) throw new Error('STATE_CONFLICT: There is no tune to undo.');
    settingsRef.current = previous;
    undoSettingsRef.current = null;
    proposalRef.current = null;
    const evidenceRetained = sessionsRef.current.some((item) => item.mode === 'adapted');
    setSettings(previous);
    setUndoSettings(null);
    setProposal(null);
    appendActivity(actor, 'Tune restored', evidenceRetained
      ? 'The previous player settings are active again; completed trial evidence was retained.'
      : 'The previous player settings are active again.');
    return {
      status: 'restored_previous_settings',
      activeSettings: previous,
      evidenceRetained,
    };
  }, [appendActivity, assertLabMutable]);

  const loadSampleCase = useCallback(() => {
    try {
      loadSampleBaseline('player');
    } catch (error) {
      appendActivity('system', 'Sample not loaded', error instanceof Error ? error.message : 'Reset the lab before loading sample evidence.');
      return;
    }
    window.requestAnimationFrame(() => {
      document.querySelector('#copilot-panel')?.scrollIntoView({
        behavior: preferredScrollBehavior(settingsRef.current.motion),
        block: 'start',
      });
    });
  }, [appendActivity, loadSampleBaseline]);

  const recordDirection = useCallback((direction: Direction) => {
    const current = sessionRef.current;
    if (!current) return;
    current.inputCount += 1;
    current.directionCounts[direction] += 1;
    if (current.lastDirection && current.lastDirection !== direction) current.directionChanges += 1;
    current.lastDirection = direction;
  }, []);

  const rotateSwitchDirection = useCallback(() => {
    if (phaseRef.current !== 'playing' || settingsRef.current.controlMode !== 'single-switch') return;
    switchDirectionRef.current = (switchDirectionRef.current + 1) % SWITCH_DIRECTIONS.length;
    const direction = SWITCH_DIRECTIONS[switchDirectionRef.current];
    setSwitchDirection(direction);
    recordDirection(direction);
  }, [recordDirection]);

  const beginPlaying = useCallback(() => {
    const captured = captureTrialLineage({
      proposal: proposalRef.current,
      sessions: sessionsRef.current,
      settings: settingsRef.current,
    });
    const mode = captured.mode as 'baseline' | 'adapted';
    const timestamp = performance.now();
    sessionRef.current = {
      id: makeId('trial'),
      mode,
      startedAt: timestamp,
      lastFrameAt: timestamp,
      targetShownAt: timestamp,
      collected: 0,
      expired: 0,
      collisions: 0,
      idleMs: 0,
      inputCount: 0,
      directionChanges: 0,
      directionCounts: { up: 0, down: 0, left: 0, right: 0 },
      reactionTimesMs: [],
      pathDistance: 0,
      lastDirection: null,
      lastCollisionAt: -10000,
      targetIndex: 0,
      courseId: PLAY_COURSE_ID,
      settingsSnapshot: captured.settingsSnapshot as Settings,
      settingsFingerprint: captured.settingsFingerprint,
      baselineId: captured.baselineId,
      appliedProposalId: captured.appliedProposalId,
    };
    inputRef.current.clear();
    switchDirectionRef.current = 0;
    setSwitchDirection(SWITCH_DIRECTIONS[0]);
    setPlayer({ x: 50, y: 72 });
    setActiveTarget(0);
    setCollected(0);
    setCollisions(0);
    if (hazardImpactTimeoutRef.current !== null) window.clearTimeout(hazardImpactTimeoutRef.current);
    hazardImpactTimeoutRef.current = null;
    setHazardImpact(null);
    setScore(0);
    setTimeLeft(20);
    phaseRef.current = 'playing';
    setPhase('playing');
    appendActivity('player', `${mode === 'baseline' ? 'Baseline' : 'Adapted'} trial started`, 'Live play signals stay on this device.');
  }, [appendActivity]);

  const startTrial = useCallback(() => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'countdown') return;
    if (proposalRef.current && ['pending', 'approved'].includes(proposalRef.current.status)) {
      appendActivity('system', 'Finish the plan first', 'Approve and apply, decline, or clear the current proposal before starting another trial.');
      setPanelTab('plan');
      return;
    }
    const activeProposal = proposalRef.current;
    if (
      activeProposal?.status === 'applied'
      && (
        activeProposal.appliedSettingsFingerprint !== settingsFingerprint(settingsRef.current)
        || !proposalIntentIsCurrent(activeProposal, selectedNeedsRef.current)
      )
    ) {
      appendActivity('system', 'Tune conditions changed', 'The exact applied preset or player intent is no longer current. Undo or reset before collecting new evidence.');
      setPanelTab('plan');
      return;
    }
    if (settingsRef.current.audioCues) void ensureAudioContext();
    setCountdown(3);
    phaseRef.current = 'countdown';
    setPhase('countdown');
  }, [appendActivity, ensureAudioContext]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const timer = window.setTimeout(() => {
      if (countdown <= 0) beginPlaying();
      else setCountdown((value) => value - 1);
    }, countdown <= 0 ? 0 : 700);
    return () => window.clearTimeout(timer);
  }, [phase, countdown, beginPlaying]);

  const finishTrial = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    const lineageStillValid = capturedLineageIsValid({
      trial: current,
      proposal: proposalRef.current,
      currentSettings: settingsRef.current,
    });
    if (!lineageStillValid) {
      sessionRef.current = null;
      inputRef.current.clear();
      phaseRef.current = 'complete';
      setPhase('complete');
      setPanelTab('plan');
      appendActivity('system', 'Trial evidence discarded', 'Settings or plan lineage changed during the run, so no comparison was recorded.');
      return;
    }
    const durationMs = Math.min(20000, performance.now() - current.startedAt);
    const finalExpired = current.expired + Math.max(0, TARGETS.length - current.targetIndex);
    const finalScore = calculateTrialScore({
      collected: current.collected,
      collisions: current.collisions,
      expired: finalExpired,
    });
    const completed: TrialSession = {
      id: current.id,
      mode: current.mode,
      createdAt: new Date().toISOString(),
      durationMs,
      collected: current.collected,
      expired: finalExpired,
      collisions: current.collisions,
      idleMs: current.idleMs,
      inputCount: current.inputCount,
      directionChanges: current.directionChanges,
      directionCounts: current.directionCounts,
      reactionTimesMs: current.reactionTimesMs,
      pathDistance: Math.round(current.pathDistance),
      score: finalScore,
      courseId: current.courseId,
      settingsSnapshot: current.settingsSnapshot,
      settingsFingerprint: current.settingsFingerprint,
      baselineId: current.baselineId,
      appliedProposalId: current.appliedProposalId,
      source: 'played',
    };
    sessionRef.current = null;
    inputRef.current.clear();
    setScore(finalScore);
    const nextSessions = completed.mode === 'baseline'
      ? [completed]
      : [
          ...sessionsRef.current.filter((item) => item.mode === 'baseline'),
          completed,
        ].slice(-4);
    sessionsRef.current = nextSessions;
    setSessions(nextSessions);
    phaseRef.current = 'complete';
    setPhase('complete');
    setPanelTab(completed.mode === 'baseline' ? 'plan' : 'signals');
    appendActivity('player', `${completed.mode === 'baseline' ? 'Baseline' : 'Adapted'} complete`, `${completed.collected} signals collected and ${completed.collisions} collisions recorded.`);
    if (completed.mode === 'baseline') {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>('#postgame-copy-button')?.focus();
      });
    } else {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('#player-check-in')?.focus();
      });
    }
  }, [appendActivity]);

  const recordPlayerCheckIn = useCallback((choice: PlayerCheckInOutcome | 'skip') => {
    if (phaseRef.current !== 'complete') return;
    const pair = findLatestCompletedPair(sessionsRef.current) as {
      baseline: TrialSession;
      adapted: TrialSession;
    } | null;
    const baseline = pair?.baseline ?? null;
    const adapted = pair?.adapted ?? null;
    if (!baseline || !adapted || baseline.source !== 'played' || adapted.source !== 'played') return;
    const playerCheckIn: PlayerCheckIn = {
      status: choice === 'skip' ? 'skipped' : 'answered',
      outcome: choice === 'skip' ? null : choice,
      baselineId: baseline.id,
      capturedVia: 'visible_player_ui',
      recordedAt: new Date().toISOString(),
    };
    const nextSessions = sessionsRef.current.map((item) => (
      item.id === adapted.id ? { ...item, playerCheckIn } : item
    ));
    sessionsRef.current = nextSessions;
    setSessions(nextSessions);
    appendActivity(
      'system',
      choice === 'skip' ? 'Visible check-in skipped' : `Visible check-in: “${playerCheckInLabels[choice]}”`,
      'Captured through the visible player UI; no WebMCP or site tool can submit this choice.',
    );
  }, [appendActivity]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let animationFrame = 0;

    const tick = (timestamp: number) => {
      const current = sessionRef.current;
      if (!current) return;
      const dt = Math.min(40, timestamp - current.lastFrameAt);
      current.lastFrameAt = timestamp;
      const elapsed = timestamp - current.startedAt;
      const remaining = Math.max(0, 20000 - elapsed);
      setTimeLeft(Math.ceil(remaining / 1000));

      const activeSettings = current.settingsSnapshot;
      const keys = inputRef.current;
      let dx = 0;
      let dy = 0;
      if (activeSettings.controlMode === 'single-switch') {
        const direction = SWITCH_DIRECTIONS[switchDirectionRef.current];
        if (direction === 'left') dx = -1;
        if (direction === 'right') dx = 1;
        if (direction === 'up') dy = -1;
        if (direction === 'down') dy = 1;
      } else {
        const leftAllowed = activeSettings.controlMode !== 'one-hand-right';
        const rightAllowed = activeSettings.controlMode !== 'one-hand-left';
        if ((leftAllowed && keys.has('KeyA')) || (rightAllowed && keys.has('ArrowLeft'))) dx -= 1;
        if ((leftAllowed && keys.has('KeyD')) || (rightAllowed && keys.has('ArrowRight'))) dx += 1;
        if ((leftAllowed && keys.has('KeyW')) || (rightAllowed && keys.has('ArrowUp'))) dy -= 1;
        if ((leftAllowed && keys.has('KeyS')) || (rightAllowed && keys.has('ArrowDown'))) dy += 1;
      }

      const isMoving = dx !== 0 || dy !== 0;
      if (shouldAccumulateIdle(activeSettings.controlMode, isMoving, current.inputCount)) {
        current.idleMs += dt;
      }
      if (isMoving && dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
      }

      const target = TARGETS[current.targetIndex];
      if (isMoving && target && activeSettings.steeringAssist > 0) {
        const tx = target.x - playerRef.current.x;
        const ty = target.y - playerRef.current.y;
        const length = Math.hypot(tx, ty) || 1;
        dx += (tx / length) * activeSettings.steeringAssist;
        dy += (ty / length) * activeSettings.steeringAssist;
      }

      const pace = 0.027 * activeSettings.gameSpeed * dt;
      const next = {
        x: Math.max(4, Math.min(96, playerRef.current.x + dx * pace)),
        y: Math.max(7, Math.min(89, playerRef.current.y + dy * pace)),
      };
      current.pathDistance += Math.hypot(next.x - playerRef.current.x, next.y - playerRef.current.y) * 10;
      playerRef.current = next;
      setPlayer(next);

      if (target) {
        const targetDistance = Math.hypot(next.x - target.x, next.y - target.y);
        const collectRadius = 3.6 + activeSettings.targetScale * 2.4;
        if (targetDistance <= collectRadius) {
          current.collected += 1;
          current.reactionTimesMs.push(timestamp - current.targetShownAt);
          current.targetIndex += 1;
          current.targetShownAt = timestamp;
          setCollected(current.collected);
          setScore(calculateTrialScore(current));
          setActiveTarget(current.targetIndex);
          playTone(740, 0.12);
        } else if (timestamp - current.targetShownAt > 4300 / activeSettings.gameSpeed) {
          current.expired += 1;
          current.targetIndex += 1;
          current.targetShownAt = timestamp;
          setActiveTarget(current.targetIndex);
          setScore(calculateTrialScore(current));
        }
      }

      const forgiveness = activeSettings.collisionForgiveness;
      for (const hazard of HAZARDS) {
        const insetX = hazard.w * forgiveness * 0.45;
        const insetY = hazard.h * forgiveness * 0.45;
        const hit = next.x > hazard.x + insetX
          && next.x < hazard.x + hazard.w - insetX
          && next.y > hazard.y + insetY
          && next.y < hazard.y + hazard.h - insetY;
        if (hit && timestamp - current.lastCollisionAt > 850) {
          current.lastCollisionAt = timestamp;
          current.collisions += 1;
          setCollisions(current.collisions);
          setScore(calculateTrialScore(current));
          setCollisionFlash(true);
          window.setTimeout(() => setCollisionFlash(false), activeSettings.motion === 'none' ? 80 : 180);
          if (hazardImpactTimeoutRef.current !== null) window.clearTimeout(hazardImpactTimeoutRef.current);
          setHazardImpact({ hazardId: hazard.id, sequence: current.collisions });
          hazardImpactTimeoutRef.current = window.setTimeout(() => {
            hazardImpactTimeoutRef.current = null;
            setHazardImpact(null);
          }, activeSettings.motion === 'none' ? 650 : 900);
          playTone(180, 0.16);
        }
      }

      if (remaining <= 0 || current.targetIndex >= TARGETS.length) {
        finishTrial();
        return;
      }
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [phase, finishTrial, playTone]);

  useEffect(() => {
    const directionForCode = (code: string): Direction | null => ({
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    } as Record<string, Direction>)[code] ?? null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (phase !== 'playing') return;
      if ((event.target as HTMLElement)?.matches('input, textarea, select, button')) return;
      const activeSettings = settingsRef.current;
      if (activeSettings.controlMode === 'single-switch' && event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) rotateSwitchDirection();
        return;
      }
      const direction = directionForCode(event.code);
      if (!direction) return;
      const leftAllowed = activeSettings.controlMode !== 'one-hand-right';
      const rightAllowed = activeSettings.controlMode !== 'one-hand-left';
      if ((event.code.startsWith('Key') && !leftAllowed) || (event.code.startsWith('Arrow') && !rightAllowed)) return;
      event.preventDefault();
      if (!inputRef.current.has(event.code)) recordDirection(direction);
      inputRef.current.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => inputRef.current.delete(event.code);
    const clearActiveInput = () => inputRef.current.clear();
    const onVisibilityChange = () => {
      if (document.hidden) clearActiveInput();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearActiveInput);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearActiveInput);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearActiveInput();
    };
  }, [phase, recordDirection, rotateSwitchDirection]);

  const pressDirection = useCallback((direction: Direction, pressed: boolean) => {
    const code = inputCodeForDirection(settingsRef.current.controlMode, direction);
    if (!code) return;
    if (pressed) {
      if (!inputRef.current.has(code)) recordDirection(direction);
      inputRef.current.add(code);
    } else {
      inputRef.current.delete(code);
    }
  }, [recordDirection]);

  const copyDemoPrompt = async () => {
    if (!agentRequest.canCopy || !agentRequest.prompt) return;
    try {
      await navigator.clipboard.writeText(agentRequest.prompt);
      setCopiedPrompt(agentRequestKey);
      appendActivity('system', 'Request copied', 'Paste it in the conversation beside this page and press Send. This page cannot send a chat message for you.');
    } catch (error) {
      appendActivity('system', 'Prompt copy unavailable', error instanceof Error ? error.message : 'Select the visible prompt and copy it manually.');
      window.requestAnimationFrame(() => {
        relayPromptRef.current?.focus();
        relayPromptRef.current?.select();
      });
    }
  };

  const focusBaselineTrial = useCallback(() => {
    const startButton = document.querySelector<HTMLButtonElement>('#trial-start-button');
    startButton?.scrollIntoView({
      behavior: preferredScrollBehavior(settingsRef.current.motion),
      block: 'center',
    });
    window.requestAnimationFrame(() => startButton?.focus({ preventScroll: true }));
  }, []);

  const focusTunePlan = useCallback(() => {
    setPanelTab('plan');
    window.requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>('#copilot-panel');
      const approveButton = panel?.querySelector<HTMLButtonElement>('.approve-button');
      (approveButton ?? panel)?.scrollIntoView({
        behavior: preferredScrollBehavior(settingsRef.current.motion),
        block: 'center',
      });
      approveButton?.focus({ preventScroll: true });
    });
  }, []);

  const retryApprovedApplyRegistration = useCallback(() => {
    if (webMcpStatus === 'error') retryBaseRegistration();
    retryCapabilityRegistration(['apply_approved_tune']);
  }, [retryBaseRegistration, retryCapabilityRegistration, webMcpStatus]);

  const handlePanelTabKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>, currentTab: PanelTab) => {
    const currentIndex = PANEL_TABS.indexOf(currentTab);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % PANEL_TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + PANEL_TABS.length) % PANEL_TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = PANEL_TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = PANEL_TABS[nextIndex];
    setPanelTab(nextTab);
    window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`#panel-tab-${nextTab}`)?.focus());
  }, []);

  const resetLab = useCallback(() => {
    if (phase === 'countdown' || phase === 'playing') return;
    const defaultSettings = { ...DEFAULT_SETTINGS } as Settings;
    settingsRef.current = defaultSettings;
    sessionsRef.current = [];
    proposalRef.current = null;
    undoSettingsRef.current = null;
    selectedNeedsRef.current = ['one-hand', 'motion'];
    phaseRef.current = 'idle';
    setSettings(defaultSettings);
    setSessions([]);
    setProposal(null);
    setUndoSettings(null);
    setSelectedNeeds(['one-hand', 'motion']);
    setFailedCapabilityRegistrations([]);
    setNeedsExpanded(false);
    setVoiceResetRevision((revision) => revision + 1);
    setPhase('idle');
    setPlayer({ x: 50, y: 72 });
    setScore(0);
    setCollected(0);
    setCollisions(0);
    if (hazardImpactTimeoutRef.current !== null) window.clearTimeout(hazardImpactTimeoutRef.current);
    hazardImpactTimeoutRef.current = null;
    setHazardImpact(null);
    setActivity([{ id: makeId('reset'), actor: 'system', title: 'Lab reset', detail: 'A clean baseline is ready.', at: nowLabel() }]);
    try {
      localStorage.removeItem(LAB_STORAGE_KEY);
    } catch {
      // The in-memory reset is authoritative when storage is unavailable.
    }
  }, [phase]);

  useEffect(() => {
    actionsRef.current = {
      inspectLab,
      loadSampleBaseline,
      proposeTune,
      applyApprovedTune,
      undoTune,
    };
  }, [inspectLab, loadSampleBaseline, proposeTune, applyApprovedTune, undoTune]);

  useEffect(() => {
    if (!hydrated) return;
    const context = getModelContext();
    if (typeof context?.registerTool !== 'function') {
      const timer = window.setTimeout(() => setWebMcpStatus('unavailable'), 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const tracker = createToolExecutionTracker();

    const register = async () => {
      const tools = createBaseTools({
        actions: {
          inspectLab: () => actionsRef.current.inspectLab(),
          loadSampleBaseline: () => actionsRef.current.loadSampleBaseline(),
          proposeTune: (input: Record<string, unknown>) => actionsRef.current.proposeTune(input as never),
        },
        getState: () => ({
          settings: settingsRef.current,
          sessions: sessionsRef.current,
          selectedNeeds: selectedNeedsRef.current,
        }),
        onCall: (name: string) => appendActivity('agent', name, 'Site tool called through the live page.'),
        onError: logToolError,
        tracker,
      });
      await registerToolSet(context, tools, controller.signal);
      if (!controller.signal.aborted) {
        setRegisteredToolNames(tools.map((tool: { name: string }) => tool.name));
        setWebMcpStatus('ready');
      }
    };

    register().catch(() => {
      if (!controller.signal.aborted) {
        setRegisteredToolNames([]);
        setWebMcpStatus('error');
        appendActivity('system', 'Base tool registration paused', 'Retry in the Tool Trail; the current page state is preserved.');
      }
      tracker.abortWhenIdle(controller);
    });
    return () => {
      tracker.abortWhenIdle(controller);
      setRegisteredToolNames([]);
    };
  }, [appendActivity, baseRegistrationRevision, hydrated, logToolError]);

  useEffect(() => {
    if (webMcpStatus !== 'ready' || proposal?.status !== 'approved' || proposalIsStale) return;
    const context = getModelContext();
    if (!context) return;
    const controller = new AbortController();
    const tracker = createToolExecutionTracker();
    const tool = createApplyTool({
      getProposal: () => proposalRef.current,
      apply: (proposalId: string) => actionsRef.current.applyApprovedTune(proposalId as never),
      onCall: (name: string) => appendActivity('agent', name, 'The agent requested the exact approved revision.'),
      onError: logToolError,
      tracker,
    });
    setFailedCapabilityRegistrations((current) => current.filter((name) => name !== tool.name));
    registerToolOnce(context, tool, controller.signal).then(() => {
      if (!controller.signal.aborted) {
        setRegisteredToolNames((current) => current.includes(tool.name) ? current : [...current, tool.name]);
        setFailedCapabilityRegistrations((current) => current.filter((name) => name !== tool.name));
        appendActivity('system', 'Apply capability registered', 'apply_approved_tune now exists in the page inventory for this exact approved revision.');
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setFailedCapabilityRegistrations((current) => current.includes(tool.name) ? current : [...current, tool.name]);
        appendActivity('system', 'Apply capability paused', 'Retry registration in place; the approved plan is preserved.');
      }
    });
    return () => {
      tracker.abortWhenIdle(controller);
      setRegisteredToolNames((current) => current.filter((name) => name !== tool.name));
    };
  }, [webMcpStatus, proposal?.status, proposal?.id, proposalIsStale, appendActivity, applyRegistrationRevision, logToolError]);

  useEffect(() => {
    if (webMcpStatus !== 'ready' || !comparisonReady) return;
    const context = getModelContext();
    if (!context) return;
    const controller = new AbortController();
    const tracker = createToolExecutionTracker();
    const tool = createCompareTool({
      getSessions: () => sessionsRef.current,
      getExpectedLineage: () => findLatestCompletedPair(sessionsRef.current)?.lineage ?? null,
      onCall: (name: string) => appendActivity('agent', name, 'The agent read the before-and-after evidence.'),
      onError: logToolError,
      tracker,
    });
    setFailedCapabilityRegistrations((current) => current.filter((name) => name !== tool.name));
    registerToolOnce(context, tool, controller.signal).then(() => {
      if (!controller.signal.aborted) {
        setRegisteredToolNames((current) => current.includes(tool.name) ? current : [...current, tool.name]);
        setFailedCapabilityRegistrations((current) => current.filter((name) => name !== tool.name));
        appendActivity('system', 'Comparison tool registered', 'compare_play_trials now exists because the visible player check-in resolved the gate.');
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setFailedCapabilityRegistrations((current) => current.includes(tool.name) ? current : [...current, tool.name]);
        appendActivity('system', 'Compare capability paused', 'Retry registration in place; the player check-in and evidence are preserved.');
      }
    });
    return () => {
      tracker.abortWhenIdle(controller);
      setRegisteredToolNames((current) => current.filter((name) => name !== tool.name));
    };
  }, [webMcpStatus, comparisonReady, appendActivity, compareRegistrationRevision, logToolError]);

  useEffect(() => {
    if (webMcpStatus !== 'ready' || !hasUndo) return;
    const context = getModelContext();
    if (!context) return;
    const controller = new AbortController();
    const tracker = createToolExecutionTracker();
    const tool = createUndoTool({
      undo: () => actionsRef.current.undoTune(),
      onCall: (name: string) => appendActivity('agent', name, 'The agent requested the reversible restore.'),
      onError: logToolError,
      tracker,
    });
    setFailedCapabilityRegistrations((current) => current.filter((name) => name !== tool.name));
    registerToolOnce(context, tool, controller.signal).then(() => {
      if (!controller.signal.aborted) {
        setRegisteredToolNames((current) => current.includes(tool.name) ? current : [...current, tool.name]);
        setFailedCapabilityRegistrations((current) => current.filter((name) => name !== tool.name));
        appendActivity('system', 'Undo tool registered', 'undo_last_tune now protects the exact prior-settings snapshot.');
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setFailedCapabilityRegistrations((current) => current.includes(tool.name) ? current : [...current, tool.name]);
        appendActivity('system', 'Undo capability paused', 'Retry registration in place; the exact prior-settings snapshot is preserved.');
      }
    });
    return () => {
      tracker.abortWhenIdle(controller);
      setRegisteredToolNames((current) => current.filter((name) => name !== tool.name));
    };
  }, [webMcpStatus, hasUndo, appendActivity, undoRegistrationRevision, logToolError]);

  const statusLabel = webMcpStatus === 'ready'
    ? `${toolNames.length} site tools live`
    : webMcpStatus === 'checking'
      ? `Checking ${expectedToolNames.length}-tool contract`
      : webMcpStatus === 'error'
        ? 'Tool registration paused · retry available'
        : `WebMCP preview · ${expectedToolNames.length}-tool contract`;

  const isTrialActive = phase === 'countdown' || phase === 'playing';
  const selectedNeedsLockReason = getSelectedNeedsLockReason({
    phase,
    proposalStatus: proposal?.status,
  });
  const canLoadSample = !isTrialActive && sessions.length === 0 && !proposal && !undoSettings;
  const activeTargetData = TARGETS[activeTarget];
  const { currentMode, completedTrialLabel } = getTrialPresentation({
    hasExactAppliedTune,
    hasAdaptedSession: Boolean(adaptedSession),
  });
  const trialBlockedByPlan = Boolean(proposal && ['pending', 'approved'].includes(proposal.status));
  const displayedToolNames = webMcpStatus === 'ready' ? toolNames : expectedToolNames;
  const activeCapabilityRegistrationFailures = failedCapabilityRegistrations.filter((name) => expectedToolNames.includes(name));
  const applyRegistrationFailed = activeCapabilityRegistrationFailures.includes('apply_approved_tune');
  const compareRegistrationFailed = activeCapabilityRegistrationFailures.includes('compare_play_trials');
  const undoRegistrationFailed = activeCapabilityRegistrationFailures.includes('undo_last_tune');
  const hasCapabilityRegistrationFailure = applyRegistrationFailed || compareRegistrationFailed || undoRegistrationFailed;
  const undoCapabilityOpen = hasUndo && registeredToolNames.includes('undo_last_tune');
  const handoffStatus = webMcpStatus === 'ready'
    ? `WEBMCP LIVE · ${toolNames.length} TOOLS`
    : webMcpStatus === 'checking'
      ? `WEBMCP CHECKING · ${expectedToolNames.length}-TOOL CONTRACT`
      : webMcpStatus === 'error'
        ? `WEBMCP PAUSED · RETRY IN PAGE`
        : `WEBMCP PREVIEW · ${expectedToolNames.length}-TOOL CONTRACT · OPEN IN CHATGPT`;
  const applyRegistrationExpected = expectedToolNames.includes('apply_approved_tune');
  const applyCapabilityOpen = applyRegistrationExpected && registeredToolNames.includes('apply_approved_tune');
  const applyCapabilityLabel = applyCapabilityOpen
    ? 'REGISTERED'
    : applyRegistrationFailed
      ? 'RETRY IN PAGE'
    : applyRegistrationExpected
      ? webMcpStatus === 'ready' ? 'REGISTERING…' : 'WAITING FOR SITE TOOLS'
    : proposal?.status === 'applied'
      ? 'REMOVED AFTER USE'
      : proposalIsStale
        ? 'STALE · REMOVED'
        : 'ABSENT UNTIL APPROVAL';
  const compareCapabilityOpen = comparisonReady && registeredToolNames.includes('compare_play_trials');
  const compareCapabilityLabel = compareCapabilityOpen
    ? comparisonReadiness?.evidenceGrade === 'demo_only' ? 'DEMO-ONLY REGISTERED' : 'REGISTERED'
    : compareRegistrationFailed
      ? 'RETRY IN PAGE'
    : adaptedSession && comparisonReadiness && !comparisonReadiness.comparisonReady
      ? 'LOCKED UNTIL PLAYER CHECK-IN'
      : adaptedSession
        ? webMcpStatus === 'ready' ? 'REGISTERING…' : 'WAITING FOR SITE TOOLS'
        : proposal?.status !== 'applied'
          ? 'WAITING FOR APPLIED TUNE'
          : 'WAITING FOR ADAPTED TRIAL';
  const handoffSurfaceMode = webMcpStatus === 'ready'
    ? 'LIVE'
    : webMcpStatus === 'checking'
      ? 'CHECKING'
      : webMcpStatus === 'error'
        ? 'PAUSED'
        : 'PREVIEW';
  const handoffCapabilityStory = compareCapabilityOpen
    ? {
        tone: 'open',
        label: 'COMPARE REGISTERED',
        detail: 'Your visible check-in registered paired evidence. No site tool could answer it.',
      }
    : comparisonReady
      ? {
          tone: compareRegistrationFailed ? 'waiting' : 'open',
          label: compareRegistrationFailed ? 'COMPARE RETRY READY' : 'COMPARE REGISTERING',
          detail: compareRegistrationFailed
            ? 'The player gate is resolved and the evidence is preserved. Retry registration in place.'
            : 'Your visible check-in made the paired comparison eligible to appear.',
        }
      : adaptedSession && comparisonReadiness && !comparisonReadiness.comparisonReady
        ? {
            tone: 'waiting',
            label: 'COMPARE ABSENT',
            detail: 'The adapted run is visible. Paired evidence still waits for your check-in.',
          }
        : proposal?.status === 'applied'
          ? {
              tone: undoRegistrationFailed ? 'waiting' : 'applied',
              label: undoCapabilityOpen
                ? 'APPLY REMOVED · UNDO REGISTERED'
                : undoRegistrationFailed
                  ? 'APPLY REMOVED · UNDO RETRY READY'
                  : 'APPLY REMOVED · UNDO REGISTERING',
              detail: undoCapabilityOpen
                ? 'Apply was single-use. Exact undo now protects the previous player setup.'
                : undoRegistrationFailed
                  ? 'Apply is gone and the prior-settings snapshot is preserved. Retry undo registration in place.'
                  : 'Apply is gone. The exact undo capability is eligible to register.',
            }
          : proposal?.status === 'approved' && !proposalIsStale
            ? {
                tone: applyRegistrationFailed ? 'waiting' : 'open',
                label: applyCapabilityOpen ? 'APPLY REGISTERED' : applyRegistrationFailed ? 'APPLY RETRY READY' : 'APPLY REGISTERING',
                detail: applyCapabilityOpen
                  ? 'Your reviewed revision—and only that revision—can run.'
                  : applyRegistrationFailed
                    ? 'The approval is preserved. Retry the exact capability without refreshing.'
                  : 'Your approval made the exact apply capability eligible to appear.',
              }
            : hasUndo
              ? {
                  tone: undoRegistrationFailed ? 'waiting' : 'applied',
                  label: undoCapabilityOpen ? 'UNDO REGISTERED' : undoRegistrationFailed ? 'UNDO RETRY READY' : 'UNDO REGISTERING',
                  detail: undoCapabilityOpen
                    ? 'The reversible settings snapshot is available to the agent from this page.'
                    : undoRegistrationFailed
                      ? 'The exact snapshot is preserved. Retry undo registration in place.'
                      : 'The exact undo capability is eligible to register.',
                }
            : {
                tone: 'closed',
                label: 'APPLY ABSENT',
                detail: 'Six tools can inspect and propose. Only your approval creates the seventh.',
              };
  const handoffCapabilityLine = webMcpStatus === 'ready'
    ? `${String(toolNames.length).padStart(2, '0')} REGISTERED · ${handoffCapabilityStory.label}`
    : `${handoffSurfaceMode} · ${handoffCapabilityStory.label}`;
  const applyReceiptState = applyCapabilityOpen
    ? 'registered'
    : proposal?.status === 'applied'
      ? 'removed'
      : proposal?.status === 'approved' && !proposalIsStale
        ? applyRegistrationFailed || webMcpStatus === 'error'
          ? 'retry'
          : webMcpStatus === 'unavailable'
            ? 'preview'
            : 'registering'
        : 'absent';
  const capabilityReceiptHeadline = applyReceiptState === 'registered'
    ? `${toolNames.length} TOOLS · APPLY REGISTERED`
    : applyReceiptState === 'removed'
      ? undoCapabilityOpen ? 'APPLY REMOVED · UNDO REGISTERED' : 'APPLY REMOVED · UNDO REGISTERING'
      : applyReceiptState === 'retry'
        ? 'APPROVAL SAFE · REGISTRATION PAUSED'
        : applyReceiptState === 'preview'
          ? 'APPROVAL SAFE · WEBMCP REQUIRED'
      : applyReceiptState === 'registering'
        ? 'PLAYER APPROVED · APPLY REGISTERING'
        : `${toolNames.length || '—'} TOOLS · APPLY ABSENT`;
  const adaptedTrialReady = Boolean(hasExactAppliedTune && !adaptedSession && proposal?.status === 'applied');
  const hazardImpactPresentation = hazardImpact ? hazardPresentationFor(hazardImpact.hazardId) : null;
  const showHazardBriefing = phase === 'idle' && sessions.length === 0;
  const baselineNeedsAgent = phase === 'complete'
    && Boolean(baselineSession)
    && !adaptedSession
    && (!proposal || proposal.status === 'declined' || proposalIsStale);
  const pendingPlanNeedsReview = phase === 'complete'
    && proposal?.status === 'pending'
    && !proposalIsStale;
  const approvedPlanNeedsAgent = phase === 'complete'
    && proposal?.status === 'approved'
    && !proposalIsStale;
  const permissionMoment = comparisonReady
    ? {
        tone: 'open',
        icon: '✓',
        title: 'Player checkpoint resolved',
        detail: 'The comparison capability is now eligible to appear.',
      }
    : adaptedSession && comparisonReadiness && !comparisonReadiness.comparisonReady
      ? {
          tone: 'waiting',
          icon: '◇',
          title: 'Player checkpoint required',
          detail: 'Paired evidence stays locked until the visible check-in.',
        }
      : proposal?.status === 'applied'
        ? {
            tone: undoRegistrationFailed ? 'waiting' : 'applied',
            icon: '↻',
            title: undoCapabilityOpen
              ? 'Applied once · undo registered'
              : undoRegistrationFailed
                ? 'Applied once · undo retry ready'
                : 'Applied once · undo registering',
            detail: undoCapabilityOpen
              ? 'The exact tune is active and one-step undo is registered.'
              : 'The exact tune is active and the prior-settings snapshot is preserved.',
          }
        : proposal?.status === 'approved' && !proposalIsStale
          ? {
              tone: 'open',
              icon: '+',
              title: applyCapabilityOpen ? 'Player approved · apply registered' : 'Player approved · apply registering',
              detail: applyCapabilityOpen
                ? 'The reviewed revision—and only that revision—can run.'
                : 'The exact plan is now eligible for the WebMCP apply capability.',
            }
          : null;

  const selectedVoiceNeedLabels = NEEDS
    .filter((need) => selectedNeeds.includes(need.id))
    .map((need) => need.label)
    .join(', ') || 'none selected';
  const voiceProposalState = proposal
    ? `${proposal.status}${proposalIsStale ? ' and stale' : ''}`
    : 'none';
  const voiceGuideContext = [
    `Lab phase: ${phase}.`,
    `WebMCP status: ${webMcpStatus}; ${registeredToolNames.length} site tools registered.`,
    `Player-selected needs: ${selectedVoiceNeedLabels}.`,
    `Baseline trial: ${baselineSession ? baselineSession.source === 'played' ? 'played' : 'transparent sample' : 'not captured'}.`,
    `Tune plan: ${voiceProposalState}.`,
    `Adapted trial: ${adaptedSession ? 'captured' : 'not captured'}.`,
    `Paired comparison: ${comparisonReady ? 'ready' : 'not ready'}.`,
    `Visible next step: ${agentRequest.instruction}`,
  ].join(' ');

  return (
    <main
      className="site-root min-h-screen overflow-x-clip text-[#f7f7f2]"
      data-motion={settings.motion}
      data-contrast={settings.contrast}
      data-game-phase={phase}
      data-run-mode={hasExactAppliedTune ? 'adapted' : 'baseline'}
      data-capability-state={handoffCapabilityStory.tone}
      data-evidence-state={comparisonReady ? 'verified' : adaptedSession ? 'check-in' : 'pending'}
    >
      <div className="ambient ambient-a" aria-hidden="true" />
      <div className="ambient ambient-b" aria-hidden="true" />

      <header className="site-header" inert={settingsOpen ? true : undefined} aria-hidden={settingsOpen || undefined}>
        <div className="header-inner">
          <a className="brand-link" href="#top" aria-label="MCPilot Adaptive Interactive Play Lab home">
            <span className="brand-mark">MP</span>
            <span className="brand-copy">
              <span>MCPILOT</span>
              <small>Adaptive interactive play lab</small>
            </span>
          </a>
          <div className="header-actions">
            <button className="header-button hidden sm:block" type="button" onClick={openSettings} disabled={isTrialActive}>Player controls</button>
            <button className="header-button compact-reset" type="button" onClick={resetLab} disabled={isTrialActive}>Reset</button>
            <button
              className={`tool-status status-${webMcpStatus}`}
              type="button"
              onClick={() => { setPanelTab('tools'); document.querySelector('#copilot-panel')?.scrollIntoView({ behavior: preferredScrollBehavior(settings.motion) }); }}
              aria-label={`${statusLabel}. Open tool panel.`}
            >
              <span className="status-dot" />{statusLabel}
            </button>
          </div>
        </div>
      </header>

      <div id="top" className="site-frame" inert={settingsOpen ? true : undefined} aria-hidden={settingsOpen || undefined}>
        <section className="hero-stage">
          <div className="hero-copy">
            <div className="hero-kicker">
              <p className="eyebrow">Human + agent accessibility tuning</p>
              <span>WEBMCP / 2026</span>
            </div>
            <h1 className="hero-title">Your approval changes <span>the agent&apos;s tools.</span></h1>
            <p className="hero-deck">
              Play once. The agent may inspect and propose. <strong>Apply does not exist until you approve the exact plan.</strong>
            </p>
            <dl className="hero-proof" aria-label="MCPilot product facts">
              <div><dt>Base page tools</dt><dd>06</dd></div>
              <div><dt>Visible player gates</dt><dd>02</dd></div>
              <div><dt>Apply tools before approval</dt><dd>00</dd></div>
            </dl>
          </div>
          <aside className={`webmcp-handoff receipt-${applyReceiptState}`} aria-label="Live WebMCP handoff">
            <div className="handoff-topline">
              <div className={`handoff-status status-${webMcpStatus}`}>
                <span className="status-dot" aria-hidden="true" />{handoffStatus}
              </div>
              <span>Actual page inventory</span>
            </div>
            <div className={`handoff-lead state-${handoffCapabilityStory.tone}`}>
              <span className="handoff-number" aria-hidden="true">{webMcpStatus === 'ready' ? String(toolNames.length).padStart(2, '0') : '··'}</span>
              <div>
                <p>{handoffCapabilityLine}</p>
                <h2>{capabilityReceiptHeadline}</h2>
              </div>
            </div>
            <div className="capability-slots" aria-label="Live WebMCP capability receipt">
              {registeredToolNames.length ? registeredToolNames.map((tool, index) => (
                <div className={`capability-slot is-registered ${['apply_approved_tune', 'compare_play_trials', 'undo_last_tune'].includes(tool) ? 'is-gated' : ''}`} key={tool} title={tool}>
                  <span>{String(index + 1).padStart(2, '0')}</span><b>{TOOL_SLOT_LABELS[tool] ?? tool}</b>
                  {['apply_approved_tune', 'compare_play_trials', 'undo_last_tune'].includes(tool) && <small>LIVE</small>}
                </div>
              )) : (
                <div className="capability-slot inventory-empty"><span>··</span><b>CHECKING LIVE INVENTORY</b></div>
              )}
            </div>
            <div className="receipt-causality" aria-label="Human approval creates the apply capability">
              <span className={applyReceiptState === 'absent' ? 'is-current' : 'is-complete'}><b>BEFORE</b> APPLY ABSENT</span>
              <i aria-hidden="true">→</i>
              <span className={proposal?.status === 'approved' || proposal?.status === 'applied' ? 'is-complete' : ''}><b>PLAYER</b> APPROVES</span>
              <i aria-hidden="true">→</i>
              <span className={applyReceiptState === 'registered' ? 'is-current' : applyReceiptState === 'removed' ? 'is-complete' : ''}><b>AFTER</b> APPLY REGISTERED</span>
            </div>
            <div className={`live-handoff-event actor-${latestActivity?.actor ?? 'system'}`} role="status" aria-live="polite" aria-atomic="true">
              <span>{latestActivity?.actor === 'agent' ? 'LIVE WEBMCP CALL' : 'LIVE EVENT'}</span>
              <div><b>{latestActivity?.title ?? 'Lab ready'}</b><p>{latestActivity?.detail ?? handoffCapabilityStory.detail}</p></div>
              <time>{latestActivity?.at ?? 'now'}</time>
            </div>
            <VoiceGuide
              blocked={isTrialActive || settingsOpen}
              context={voiceGuideContext}
              resetRevision={voiceResetRevision}
            />
            <div className={`agent-relay ${copied ? 'is-copied' : ''}`}>
              <div>
                <p>{copied ? 'Request copied · one step remains' : agentRequest.eyebrow}</p>
                <b>{copied ? 'Paste it in the conversation beside this page, then press Send.' : agentRequest.instruction}</b>
                {copied && <small>This page copied text only—it did not send a message.</small>}
                {agentRequest.prompt && (
                  <textarea
                    ref={relayPromptRef}
                    className="relay-prompt"
                    aria-label="Exact request for the browser agent"
                    readOnly
                    rows={2}
                    value={agentRequest.prompt}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                )}
              </div>
              {agentRequest.canCopy ? (
                <button type="button" onClick={copyDemoPrompt}>{copied ? 'Copied — paste now' : agentRequest.buttonLabel}</button>
              ) : !baselineSession ? (
                <button type="button" onClick={focusBaselineTrial}>{agentRequest.buttonLabel} <span aria-hidden="true">→</span></button>
              ) : proposal?.status === 'pending' ? (
                <button type="button" onClick={() => {
                  document.querySelector('#copilot-panel')?.scrollIntoView({ behavior: preferredScrollBehavior(settings.motion), block: 'center' });
                  window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.approve-button')?.focus({ preventScroll: true }));
                }}>{agentRequest.buttonLabel}</button>
              ) : proposal?.status === 'applied' && !adaptedSession ? (
                <button type="button" onClick={() => {
                  document.querySelector('.arena')?.scrollIntoView({ behavior: preferredScrollBehavior(settings.motion), block: 'center' });
                  window.requestAnimationFrame(() => startTrial());
                }} disabled={isTrialActive}>{agentRequest.buttonLabel}</button>
              ) : adaptedSession && !comparisonReady ? (
                <button type="button" onClick={() => {
                  setPanelTab('signals');
                  window.requestAnimationFrame(() => {
                    const checkIn = document.querySelector<HTMLElement>('#player-check-in');
                    checkIn?.scrollIntoView({ behavior: preferredScrollBehavior(settings.motion), block: 'center' });
                    checkIn?.focus({ preventScroll: true });
                  });
                }}>{agentRequest.buttonLabel}</button>
              ) : (
                <button type="button" disabled>{agentRequest.buttonLabel}</button>
              )}
            </div>
          </aside>
        </section>

        <div className="experience-rail" aria-label="Live product characteristics">
          <span><b>01</b> Playable proof</span>
          <i aria-hidden="true" />
          <span>Local state · player-gated · reversible</span>
        </div>

        <section id="lab" className="product-grid">
          <div className="game-shell">
            <div className="game-toolbar">
              <div>
                <p className="eyebrow text-[#8e97aa]">Orbital trial / {currentMode}</p>
                <p className="mt-1 text-sm font-bold">Collect mint signals while avoiding anomalies.</p>
              </div>
              <div className="score-strip" role="group" aria-label="Trial status">
                <span><small>TIME</small><b>{String(timeLeft).padStart(2, '0')}</b></span>
                <span><small>SIGNALS</small><b>{collected}/{TARGETS.length}</b></span>
                <span><small>HITS</small><b>{collisions}</b></span>
                <span><small>SCORE</small><b>{String(score).padStart(3, '0')}</b></span>
              </div>
              <p className="sr-only" aria-live="polite" aria-atomic="true">
                Signals {collected} of {TARGETS.length}. Hits {collisions}.
                {hazardImpactPresentation ? ` Last impact: ${hazardImpactPresentation.name}.` : ''}
              </p>
            </div>

            <div className={`arena ${collisionFlash ? 'collision-flash' : ''}`} aria-label="Orbital trial play area">
              <div className="arena-grid" />
              <ArenaAtmosphere />
              {latestActivity && (latestActivity.actor === 'agent' || latestActivity.title === 'Plan approved' || latestActivity.title.toLowerCase().includes('registered')) && (
                <div className={`arena-stage-flash actor-${latestActivity.actor}`} key={latestActivity.id} aria-hidden="true">
                  <span>{latestActivity.actor === 'agent' ? 'LIVE WEBMCP CALL' : latestActivity.title === 'Plan approved' ? 'PLAYER GATE' : 'CAPABILITY CHANGE'}</span>
                  <strong>{latestActivity.title}</strong>
                </div>
              )}
              <div className="arena-vignette" />
              {hazardImpact && hazardImpactPresentation && (
                <div aria-hidden="true" className="arena-impact" key={hazardImpact.sequence}>
                  <span>COLLISION // IDENTIFIED</span>
                  <strong>{hazardImpactPresentation.name}</strong>
                </div>
              )}
              {HAZARDS.map((hazard) => {
                const presentation = hazardPresentationFor(hazard.id);
                return (
                  <div
                    aria-label={`${presentation.name}, ${presentation.cue.toLowerCase()} collision hazard`}
                    className={`obstacle obstacle-${presentation.variant}${hazardImpact?.hazardId === hazard.id ? ' is-impact' : ''}`}
                    key={hazard.id}
                    role="img"
                    style={{
                      left: `${hazard.x}%`,
                      top: `${hazard.y}%`,
                      width: `${hazard.w}%`,
                      height: `${hazard.h}%`,
                      '--hazard-angle': `${hazard.angle}deg`,
                      '--hazard-image': `url("${presentation.image}")`,
                    } as React.CSSProperties}
                  >
                    <span aria-hidden="true" className="obstacle-art" />
                    <span aria-hidden="true" className="obstacle-effect" />
                    <span aria-hidden="true" className="obstacle-glyph">{presentation.shortLabel}</span>
                  </div>
                );
              })}
              {activeTargetData && phase === 'playing' && (
                <div
                  className="signal"
                  style={{ left: `${activeTargetData.x}%`, top: `${activeTargetData.y}%`, '--target-scale': settings.targetScale } as React.CSSProperties}
                  aria-label="Active signal"
                ><span /></div>
              )}
              <div className="player-orb" style={{ left: `${player.x}%`, top: `${player.y}%` }} aria-label="Player orb"><span /></div>

              {phase !== 'playing' && (
                <div className="arena-overlay">
                  {phase === 'countdown' ? (
                    <div className="countdown" role="status" aria-live="assertive">{countdown || 'GO'}</div>
                  ) : (
                    <>
                    <div className={`arena-intro-card ${baselineNeedsAgent ? 'is-next-step' : ''}`}>
                      <p className="eyebrow">
                        {baselineNeedsAgent
                          ? copied ? 'COPIED — NOT SENT' : 'STEP 2 · ASK THE AGENT'
                          : pendingPlanNeedsReview
                            ? 'STEP 3 · PLAYER REVIEW'
                            : approvedPlanNeedsAgent
                              ? 'APPROVED · ONE STEP REMAINS'
                              : adaptedTrialReady
                                ? 'Approved tune active'
                                : phase === 'complete' ? 'Trial captured' : 'Visible-input trial'}
                      </p>
                      <h2>
                        {baselineNeedsAgent
                          ? copied ? 'Now paste it into chat and press Send.' : 'Baseline captured. Next: ask the agent.'
                          : pendingPlanNeedsReview
                            ? 'The agent proposed a plan. You decide.'
                            : approvedPlanNeedsAgent
                              ? 'Now ask the agent to apply it.'
                              : adaptedTrialReady
                                ? 'Your exact plan is on the field.'
                                : phase === 'complete' ? 'The evidence is ready.' : 'Twenty seconds. Your way.'}
                      </h2>
                      <p id={baselineNeedsAgent ? 'postgame-next-instructions' : undefined}>
                        {baselineNeedsAgent
                          ? copied
                            ? 'Nothing is running yet. This page cannot send chat messages or change settings.'
                            : 'Copy this request, paste it in the conversation beside this page, then press Send.'
                          : pendingPlanNeedsReview
                            ? 'Nothing changes until you approve the exact revision in the Tune plan panel.'
                            : approvedPlanNeedsAgent
                              ? agentRequest.instruction
                              : adaptedTrialReady
                          ? 'Same course. New settings. Play again and let the visible result challenge the proposal.'
                          : phase === 'complete'
                          ? comparisonReadiness && !comparisonReadiness.comparisonReady
                            ? 'Your visible check-in registers the agent-facing metrics and paired comparison.'
                            : 'Your agent can now read compact performance signals—never a diagnosis.'
                          : settings.controlMode === 'single-switch'
                             ? 'Press Space or use Change direction below. The orb moves continuously.'
                             : `${controlLabels[settings.controlMode]}. Touch controls are also available below.`}
                      </p>
                      {baselineNeedsAgent && (
                        <div className="postgame-path" aria-label="Post-game next steps">
                          <span className="is-done"><b>1</b><small>Run saved</small></span>
                          <span className="is-current"><b>2</b><small>Send in chat</small></span>
                          <span><b>3</b><small>Review plan</small></span>
                        </div>
                      )}
                      {adaptedTrialReady && proposal && (
                        <div className="approved-tune-summary" aria-label="Approved tune now active">
                          {proposal.diffs.slice(0, 3).map((diff) => (
                            <span key={String(diff.key)}><small>{diff.label}</small><b><SettingValue settingKey={diff.key} value={diff.to} /></b></span>
                          ))}
                        </div>
                      )}
                      <div className="arena-card-actions">
                        {baselineNeedsAgent ? (
                          <>
                            <button
                              id="postgame-copy-button"
                              className="start-button"
                              type="button"
                              onClick={copyDemoPrompt}
                              aria-describedby="postgame-next-instructions"
                            >
                              {copied ? 'Copy again' : '1 · Copy request'} <span aria-hidden="true">→</span>
                            </button>
                            <button className="arena-secondary-action" type="button" onClick={startTrial}>Replay baseline</button>
                          </>
                        ) : pendingPlanNeedsReview ? (
                          <button className="start-button" type="button" onClick={focusTunePlan}>Review exact plan <span aria-hidden="true">→</span></button>
                        ) : approvedPlanNeedsAgent ? (
                          <button
                            className="start-button"
                            type="button"
                            onClick={agentRequest.canCopy ? copyDemoPrompt : applyRegistrationNeedsRetry ? retryApprovedApplyRegistration : undefined}
                            disabled={!agentRequest.canCopy && !applyRegistrationNeedsRetry}
                          >
                            {copied && agentRequest.canCopy ? 'Copy again' : agentRequest.buttonLabel} <span aria-hidden="true">→</span>
                          </button>
                        ) : (
                          <button id="trial-start-button" className="start-button" type="button" onClick={startTrial} disabled={trialBlockedByPlan}>
                            {trialBlockedByPlan
                              ? 'Review the tune plan first'
                              : phase === 'complete'
                                ? completedTrialLabel
                                : `Start ${currentMode.toLowerCase()}`} <span aria-hidden="true">→</span>
                          </button>
                        )}
                      </div>
                    </div>
                    {showHazardBriefing && (
                      <aside className="hazard-dossier" aria-label="Course hazard briefing">
                        <p><span>THREAT INDEX</span><b>03</b></p>
                        <div>
                          {HAZARDS.map((hazard, index) => {
                            const presentation = hazardPresentationFor(hazard.id);
                            return (
                              <article className={`hazard-dossier-card obstacle-${presentation.variant}`} key={hazard.id}>
                                <span className="hazard-dossier-number" aria-hidden="true">0{index + 1}</span>
                                <span
                                  aria-hidden="true"
                                  className="hazard-dossier-art"
                                  style={{ '--hazard-image': `url("${presentation.image}")` } as React.CSSProperties}
                                />
                                <span className="hazard-dossier-copy"><b>{presentation.name}</b><small>{presentation.cue}</small></span>
                              </article>
                            );
                          })}
                        </div>
                      </aside>
                    )}
                    </>
                  )}
                </div>
              )}

              <div className="trial-badges" aria-hidden="true">
                <span className={`run-badge ${hasExactAppliedTune ? 'is-adapted' : ''}`}>{hasExactAppliedTune ? 'ADAPTED RUN' : 'BASELINE RUN'}</span>
                <span>{motionLabels[settings.motion]}</span>
                <span>{Math.round(settings.gameSpeed * 100)}% pace</span>
                {settings.steeringAssist > 0 && <span>{Math.round(settings.steeringAssist * 100)}% assist</span>}
              </div>
              <div className={`arena-event actor-${latestActivity?.actor ?? 'system'}`}>
                <span>{latestActivity?.actor === 'agent' ? 'WEBMCP' : latestActivity?.actor?.toUpperCase() ?? 'SYSTEM'}</span>
                <div><b>{latestActivity?.title ?? 'Arena ready'}</b><small>{latestActivity?.detail ?? 'Start a baseline to create evidence.'}</small></div>
              </div>
            </div>

            <div className="game-footer">
              <div className="control-hint">
                {settings.controlMode === 'single-switch' ? (
                  <><span className="key wide">SPACE</span><span>or the button to rotate direction</span></>
                ) : settings.controlMode === 'one-hand-left' ? (
                  <><span className="key">WASD</span><span>move</span></>
                ) : settings.controlMode === 'one-hand-right' ? (
                  <><span className="key">ARROWS</span><span>move</span></>
                ) : (
                  <><span className="key">WASD</span><span className="text-[#657086]">or</span><span className="key">ARROWS</span><span>move</span></>
                )}
              </div>
              <div
                className={`touch-controls ${settings.controlMode === 'single-switch' ? 'single-switch' : ''}`}
                role="group"
                aria-label={settings.controlMode === 'single-switch' ? 'Single-switch control' : 'Touch movement controls'}
              >
                {settings.controlMode === 'single-switch' && (
                  <>
                    <button
                      className="switch-control"
                      type="button"
                      aria-label={`Change direction. Currently moving ${switchDirection}.`}
                      disabled={phase !== 'playing'}
                      onClick={rotateSwitchDirection}
                    >Change direction · {switchDirection}</button>
                    <p className="sr-only" aria-live="polite" aria-atomic="true">
                      Current single-switch direction: {switchDirection}.
                    </p>
                  </>
                )}
                {settings.controlMode !== 'single-switch' && (['left', 'up', 'down', 'right'] as Direction[]).map((direction) => (
                  <TouchDirectionButton
                    key={direction}
                    direction={direction}
                    disabled={phase !== 'playing'}
                    onDirectionChange={pressDirection}
                  />
                ))}
              </div>
              <button className="manual-settings" type="button" onClick={openSettings} disabled={isTrialActive}>Tune manually</button>
            </div>
          </div>

          <aside id="copilot-panel" className="copilot-panel">
            <div className="panel-heading">
              <div className="flex items-center gap-3">
                <span className="agent-face" aria-hidden="true"><i /><i /></span>
                <div>
                  <p className="eyebrow agent-kicker">Live WebMCP handoff</p>
                  <h2 className="text-lg font-extrabold tracking-tight">The second seat. You keep the controls.</h2>
                </div>
              </div>
              <button className="demo-link" type="button" onClick={loadSampleCase} disabled={!canLoadSample}>
                {baselineSession?.source === 'sample' ? 'Sample baseline loaded' : 'Load sample baseline'}
              </button>
            </div>

            <div className={`needs-block ${needsPanelOpen ? 'is-open' : 'is-collapsed'}`}>
              <button
                className="needs-summary"
                type="button"
                aria-expanded={needsPanelOpen}
                aria-controls="player-needs-options"
                disabled={!baselineSession}
                onClick={() => setNeedsExpanded((current) => !current)}
              >
                <span>What should play respect?</span>
                <span className="needs-summary-meta">
                  <span className="needs-count">{selectedNeeds.length} active {selectedNeeds.length === 1 ? 'preference' : 'preferences'}</span>
                  {baselineSession && <span className="needs-toggle">{needsPanelOpen ? 'Collapse' : 'Change'}</span>}
                </span>
              </button>
              {needsPanelOpen && (
                <div className="needs-options" id="player-needs-options">
                  {NEEDS.map((need) => {
                    const active = selectedNeeds.includes(need.id);
                    return (
                      <button
                        className={`need-chip ${active ? 'is-selected' : ''}`}
                        type="button"
                        aria-pressed={active}
                        disabled={Boolean(selectedNeedsLockReason)}
                        key={need.id}
                        onClick={() => toggleNeed(need.id)}
                      >{active && <span aria-hidden="true">✓</span>}{need.label}</button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="panel-tabs" role="tablist" aria-label="MCPilot panels">
              {PANEL_TABS.map((tab) => (
                <button
                  key={tab}
                  id={`panel-tab-${tab}`}
                  role="tab"
                  aria-selected={panelTab === tab}
                  aria-controls={`panel-${tab}`}
                  tabIndex={panelTab === tab ? 0 : -1}
                  className={panelTab === tab ? 'is-active' : ''}
                  type="button"
                  onClick={() => setPanelTab(tab)}
                  onKeyDown={(event) => handlePanelTabKeyDown(event, tab)}
                >{tab === 'plan' ? 'Tune plan' : tab === 'signals' ? 'Play signals' : 'Tool trail'}{tab === 'tools' && <em>{activity.filter((item) => item.actor === 'agent').length}</em>}</button>
              ))}
            </div>

            <div className="panel-scroll-region">
            <div
              className="panel-content"
              id={`panel-${panelTab}`}
              role="tabpanel"
              aria-labelledby={`panel-tab-${panelTab}`}
              tabIndex={0}
            >
              {panelTab === 'plan' && (
                <div>
                  {!proposal ? (
                    <div className="empty-state">
                      <span className="empty-icon" aria-hidden="true">↗</span>
                      <h3>{baselineSession ? 'Baseline captured. Ask the agent next.' : 'Evidence first. Settings second.'}</h3>
                      <p>{baselineSession
                        ? copied
                          ? 'Copied—not sent. Paste the request in the conversation beside this page, then press Send.'
                          : '1. Copy the request. 2. Paste it in the conversation beside this page. 3. Press Send.'
                        : 'Play a baseline, or load clearly labeled sample evidence before asking for a tune.'}</p>
                      {baselineSession
                        ? <div className="empty-actions">
                            <button type="button" onClick={copyDemoPrompt}>{copied ? 'Copy again' : '1 · Copy request'}</button>
                            <button className="secondary" type="button" onClick={() => setPanelTab('signals')}>View evidence</button>
                          </div>
                        : <button type="button" onClick={loadSampleCase} disabled={!canLoadSample}>Load transparent sample baseline</button>}
                    </div>
                  ) : (
                    <div className="proposal-card">
                      <div className="flex items-center justify-between">
                        <span className={`proposal-status status-${proposalIsStale ? 'stale' : proposal.status}`}>{proposalIsStale ? 'Stale plan' : proposal.status === 'pending' ? 'Needs your review' : proposal.status}</span>
                        <span className="proposal-id font-mono text-xs text-[#9ca8bd]">{proposal.id}</span>
                      </div>
                      <div className={`evidence-banner proposal-evidence evidence-${proposal.baselineEvidenceGrade}`}>
                        <span>{proposal.baselineEvidenceGrade === 'played_trial' ? 'PLAYED BASELINE' : 'FICTIONAL SAMPLE · DEMO PLAN'}</span>
                        <p>{proposal.courseId} · {proposal.selectedNeeds.length ? proposal.selectedNeeds.map((id) => NEEDS.find((need) => need.id === id)?.label ?? id).join(' · ') : 'No stated preference'}</p>
                      </div>
                      <h3 className="mt-4 text-base font-extrabold">Agent-proposed tune</h3>
                      <p className="mt-2 text-xs leading-5 text-[#aab2c4]">{proposal.rationale}</p>

                      <div className="mt-4 space-y-2">
                        {proposal.diffs.map((diff) => (
                          <div className="change-row" key={String(diff.key)}>
                            <span>{diff.label}</span>
                            <span className="change-values">
                              <s><SettingValue settingKey={diff.key} value={diff.from} /></s>
                              <b aria-hidden="true">→</b>
                              <strong><SettingValue settingKey={diff.key} value={diff.to} /></strong>
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="challenge-note">
                        <span aria-hidden="true">◇</span>
                        <div><b>Challenge preserved</b><p>{proposal.preserveChallenge}</p></div>
                      </div>

                      {proposalIsStale && (
                        <div className="approval-ready stale" role="status">
                          <span>!</span><div><b>{proposalFreshness.settingsChanged && proposalFreshness.selectedNeedsChanged ? 'Settings and player intent changed' : proposalFreshness.selectedNeedsChanged ? 'Player intent changed' : 'Settings changed'}</b><p>The proposal no longer matches the visible setup, so approval and apply are unavailable.</p></div>
                        </div>
                      )}
                      {proposal.status === 'pending' && !proposalIsStale && (
                        <div className="approval-ready pending" role="status">
                          <span>?</span><div><b>Visible review required</b><p>The proposal cannot change active settings until this exact revision is approved and applied.</p></div>
                        </div>
                      )}
                      {proposal.status === 'approved' && !proposalIsStale && (
                        <div className="approval-ready" role="status">
                          <span>✓</span><div><b>Approval recorded</b><p>The exact apply capability is registering. The live receipt confirms only after it becomes real.</p></div>
                        </div>
                      )}
                      {proposal.status === 'applied' && (
                        <div className="approval-ready applied" role="status">
                          <span>✓</span><div><b>Tune active</b><p>Play an adapted trial, then compare the evidence.</p></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {panelTab === 'signals' && (
                <div>
                  {!latestSignals ? (
                    <div className="empty-state">
                      <span className="empty-icon" aria-hidden="true">⌁</span>
                      <h3>No trial evidence yet.</h3>
                      <p>Signals appear only after a completed run or an explicitly labeled sample.</p>
                      <button type="button" onClick={loadSampleCase} disabled={!canLoadSample}>Use sample evidence</button>
                    </div>
                  ) : (
                    <div>
                      {comparisonReadiness?.evidenceGrade === 'played_pair' && adaptedSession && (
                        <PlayerCheckInPanel
                          checkIn={adaptedSession.playerCheckIn ?? null}
                          onSelect={recordPlayerCheckIn}
                        />
                      )}

                      {comparisonReadiness && !comparisonReadiness.comparisonReady ? (
                        <div className="comparison-pending" role="status">
                          <span aria-hidden="true">◇</span>
                          <div><b>Comparison waits for the player</b><p>Paired deltas, the verdict, and the comparison tool stay locked until the visible check-in is answered or skipped.</p></div>
                        </div>
                      ) : comparison ? (
                        <div>
                          <div className={`evidence-banner evidence-${comparison.evidenceGrade}`}>
                            <span>{comparison.evidenceGrade === 'played_pair' ? 'PLAYED PAIR' : 'DEMO ONLY · FICTIONAL EVIDENCE'}</span>
                            <p>
                              {comparison.evidenceGrade === 'played_pair'
                                ? `${comparison.courseId} · baseline and adapted runs were played`
                                : `${comparison.courseId} · ${comparison.baselineSource} baseline + ${comparison.adaptedSource} adapted`}
                            </p>
                          </div>
                          <div
                            className={`comparison-hero comparison-${comparison.verdict}`}
                            id="comparison-result"
                            role="status"
                            tabIndex={-1}
                          >
                            <span className={`verdict verdict-${comparison.verdict}`}>{comparison.verdict.replaceAll('_', ' ')}</span>
                            <div className="comparison-scoreline">
                              <span>{baselineSession?.score ?? '—'}</span>
                              <i aria-hidden="true">→</i>
                              <strong className={!comparison.claimableOutcome ? 'metric-neutral' : comparison.scoreDelta < 0 ? 'metric-negative' : comparison.scoreDelta > 0 ? 'metric-positive' : ''}>{adaptedSession?.score ?? '—'}</strong>
                            </div>
                            <small>{comparison.claimableOutcome ? `score · ${comparison.scoreDelta >= 0 ? '+' : ''}${comparison.scoreDelta}` : `raw score · ${comparison.scoreDelta >= 0 ? '+' : ''}${comparison.scoreDelta}`}</small>
                            <p>{comparison.summary}</p>
                            {comparison.materialRegressions.length > 0 && (
                              <p className="regression-note">Guardrail triggered: {comparison.materialRegressions.join(', ').replaceAll('_', ' ')}.</p>
                            )}
                          </div>
                          {comparison.evidenceGrade === 'played_pair' && (
                            <div className={`player-outcome outcome-${comparison.playerCheckIn.outcome ?? comparison.playerCheckIn.status}`}>
                              <small>Visible player check-in</small>
                              <b>{comparison.playerCheckIn.status === 'skipped' ? 'Skipped' : playerCheckInLabels[comparison.playerCheckIn.outcome as PlayerCheckInOutcome]}</b>
                              <span>{comparison.playerCheckIn.status === 'skipped' ? 'Objective telemetry only · no player-outcome claim' : 'Captured through visible player UI'}</span>
                            </div>
                          )}
                          {baselineResultSignals && adaptedResultSignals && (
                            <div className="result-board" aria-label="Baseline to adapted results">
                              <div className="result-metric">
                                <small>Accuracy</small>
                                <div><span>{baselineResultSignals.accuracyPercent}%</span><i>→</i><strong>{adaptedResultSignals.accuracyPercent}%</strong></div>
                                <em className={comparison.claimableOutcome && comparison.accuracyDeltaPoints < 0 ? 'metric-negative' : comparison.claimableOutcome && comparison.accuracyDeltaPoints > 0 ? 'metric-positive' : ''}>{comparison.accuracyDeltaPoints >= 0 ? '+' : ''}{comparison.accuracyDeltaPoints} pts</em>
                              </div>
                              <div className="result-metric">
                                <small>Collision rate</small>
                                <div><span>{baselineResultSignals.collisionRatePer10s}</span><i>→</i><strong>{adaptedResultSignals.collisionRatePer10s}</strong></div>
                                <em className={comparison.claimableOutcome && comparison.collisionRateDeltaPer10s > 0 ? 'metric-negative' : comparison.claimableOutcome && comparison.collisionRateDeltaPer10s < 0 ? 'metric-positive' : ''}>{comparison.collisionRateDeltaPer10s > 0 ? '+' : ''}{comparison.collisionRateDeltaPer10s}/10s</em>
                              </div>
                              <div className="result-metric">
                                <small>Median collect time</small>
                                <div><span>{baselineResultSignals.medianResponseMs === null ? '—' : `${baselineResultSignals.medianResponseMs}ms`}</span><i>→</i><strong>{adaptedResultSignals.medianResponseMs === null ? '—' : `${adaptedResultSignals.medianResponseMs}ms`}</strong></div>
                                <em className={comparison.claimableOutcome && comparison.medianResponseDeltaMs !== null && comparison.medianResponseDeltaMs > 0 ? 'metric-negative' : comparison.claimableOutcome && comparison.medianResponseDeltaMs !== null && comparison.medianResponseDeltaMs < 0 ? 'metric-positive' : ''}>{comparison.medianResponseDeltaMs === null ? 'no pair' : `${comparison.medianResponseDeltaMs > 0 ? '+' : ''}${comparison.medianResponseDeltaMs}ms`}</em>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className={`evidence-banner evidence-${latestSignals.evidenceGrade}`}>
                            <span>{latestSignals.source === 'played' ? 'PLAYED TRIAL' : 'FICTIONAL SAMPLE · WORKFLOW ONLY'}</span>
                            <p>{latestSignals.courseId} · {latestSignals.source === 'played' ? 'observed on this device' : 'not outcome evidence'}</p>
                          </div>
                          <div className="signal-summary">
                            <div><small>Score</small><b>{latestSignals.score}</b></div>
                            <div><small>Accuracy</small><b>{latestSignals.accuracyPercent}%</b></div>
                            <div><small>{latestSignals.idleMetric === 'before_first_switch_input' ? 'Switch wait' : 'Idle'}</small><b>{latestSignals.idlePercent}%</b></div>
                          </div>
                          <div className="mt-5 space-y-4">
                            <MiniMeter value={latestSignals.accuracyPercent} label="Signal capture" />
                            <MiniMeter value={Math.max(0, 100 - latestSignals.idlePercent)} label={latestSignals.idleMetric === 'before_first_switch_input' ? 'After first switch' : 'Active input'} tone="yellow" />
                            <MiniMeter value={Math.max(0, 100 - latestSignals.collisionRatePer10s * 18)} label="Hazard control" tone="red" />
                          </div>
                          <div className="mt-5 space-y-2">
                            {latestSignals.observations.map((observation: { code: string; severity: string; evidence: string; suggestion: string }) => (
                              <div className="observation" key={observation.code}>
                                <span className={`severity severity-${observation.severity}`} aria-hidden="true" />
                                <div>
                                  <div className="observation-title">
                                    <b>{observation.code.replaceAll('_', ' ')}</b>
                                    <span>{observation.severity}</span>
                                  </div>
                                  <p>{observation.evidence}</p>
                                  <small>{observation.suggestion}</small>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {panelTab === 'tools' && (
                <div>
                  <div className="tool-contract">
                    <div>
                      <p className="eyebrow text-[#72f1b8]">Live page contract</p>
                      <h3>{webMcpStatus === 'ready'
                        ? `${toolNames.length} discoverable tools`
                        : webMcpStatus === 'error'
                          ? 'Registration paused · state preserved'
                          : `${expectedToolNames.length}-tool contract preview`}</h3>
                    </div>
                    <span className={`contract-light ${webMcpStatus === 'ready' ? 'is-live' : ''}`} />
                  </div>
                  <div className="tool-list">
                    {displayedToolNames.map((tool) => (
                      <div key={tool}><code>{tool}</code><span>{tool === 'compare_play_trials' ? 'GATED READ' : ['inspect_play_lab', 'read_play_signals', 'list_adaptations', 'export_access_preset'].includes(tool) ? 'READ' : tool === 'apply_approved_tune' ? 'PLAYER-GATED' : 'WRITE'}</span></div>
                    ))}
                  </div>
                  <p className="tool-note">{webMcpStatus === 'ready'
                    ? 'These tools are registered on the live page.'
                    : webMcpStatus === 'error'
                      ? 'The page kept the current proposal and evidence. Retry here without refreshing.'
                      : 'This browser is showing the exact contract; open the page in ChatGPT or WebMCP-enabled Chrome to activate it.'} Strict schemas, compact results, and AbortSignal cleanup keep the handoff bounded.</p>
                  {webMcpStatus === 'error' && (
                    <button className="registration-retry" type="button" onClick={retryBaseRegistration}>Retry base tool registration · keep state</button>
                  )}
                  <div className="activity-list">
                    {activity.map((item) => (
                      <div className={`activity-row actor-${item.actor}`} key={item.id}>
                        <span>{item.actor === 'agent' ? 'A' : item.actor === 'player' ? 'P' : '·'}</span>
                        <div><b>{item.title}</b><p>{item.detail}</p></div>
                        <time>{item.at}</time>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="panel-gate-dock">
              <div className={`dock-capability-receipt receipt-${applyReceiptState}`}>
                <span>{webMcpStatus === 'ready' ? String(toolNames.length).padStart(2, '0') : '··'}</span>
                <div>
                  <small>Live WebMCP inventory</small>
                  <b>{capabilityReceiptHeadline}</b>
                  <p>{latestAgentActivity ? `Last agent call: ${latestAgentActivity.title}` : 'Waiting for the first site-tool call.'}</p>
                </div>
                <i className={`receipt-light ${webMcpStatus === 'ready' ? 'is-live' : ''}`} aria-hidden="true" />
              </div>
              {permissionMoment && (
                <div className={`permission-moment permission-${permissionMoment.tone}`}>
                  <span aria-hidden="true">{permissionMoment.icon}</span>
                  <div><small>Permission event</small><b>{permissionMoment.title}</b><p>{permissionMoment.detail}</p></div>
                </div>
              )}
              {proposal?.status !== 'applied' && !adaptedSession && (
                <div className={`capability-gate ${applyCapabilityOpen ? 'is-open' : ''}`}>
                  <div><code>apply_approved_tune</code><small>appears only after exact player approval</small></div>
                  <strong>{applyCapabilityLabel}</strong>
                </div>
              )}
              {(proposal?.status === 'applied' || adaptedSession) && (
                <div className={`capability-gate compare-gate ${compareCapabilityOpen ? 'is-open' : ''}`}>
                  <div><code>compare_play_trials</code><small>played pairs wait for a visible player check-in</small></div>
                  <strong>{compareCapabilityLabel}</strong>
                </div>
              )}
              {hasCapabilityRegistrationFailure && (
                <button className="registration-retry" type="button" onClick={() => retryCapabilityRegistration(activeCapabilityRegistrationFailures)}>Retry gated capability · keep state</button>
              )}
              {proposal?.status === 'pending' && !proposalIsStale && (
                <div className="dock-actions two">
                  <button className="approve-button" type="button" onClick={approveProposal}>Approve exact plan</button>
                  <button className="decline-button" type="button" onClick={declineProposal}>Decline</button>
                </div>
              )}
              {proposal?.status === 'approved' && !proposalIsStale && (
                <>
                  <div className="agent-next-action">
                    <div><small>WebMCP next</small><b>{applyCapabilityOpen ? 'Apply is live. Ask the browser agent to use this exact revision.' : 'Your approval is recorded. Waiting for Apply to register.'}</b></div>
                    <button type="button" onClick={copyDemoPrompt} disabled={!applyCapabilityOpen}>{copied ? 'Copied — paste now' : 'Copy apply request'}</button>
                  </div>
                  <div className="dock-actions two is-fallback">
                    <button className="decline-button" type="button" onClick={() => applyApprovedTune(proposal.id, 'player')}>Manual fallback</button>
                    <button className="decline-button" type="button" onClick={clearProposal}>Cancel approval</button>
                  </div>
                </>
              )}
              {proposal?.status === 'applied' && !adaptedSession && (
                <div className={`dock-actions ${hasUndo ? 'two' : ''}`}>
                  <button className="approve-button" type="button" onClick={startTrial} disabled={isTrialActive}>Start adapted trial</button>
                  {hasUndo && <button className="decline-button" type="button" onClick={() => undoTune('player')} disabled={isTrialActive}>Undo tune</button>}
                </div>
              )}
              {adaptedSession && hasUndo && (
                <div className="dock-actions">
                  <button className="decline-button" type="button" onClick={() => undoTune('player')} disabled={isTrialActive}>Undo tune · keep evidence</button>
                </div>
              )}
              {proposalIsStale && (
                <div className="dock-actions">
                  <button className="decline-button" type="button" onClick={clearProposal}>Clear stale plan</button>
                </div>
              )}
              {proposal?.status === 'declined' && (
                <div className="dock-actions">
                  <button className="decline-button" type="button" onClick={clearProposal}>Clear declined plan</button>
                </div>
              )}
            </div>
            </div>

          </aside>
        </section>

        <section className="principles-section">
          <div className="principles-copy">
            <p className="eyebrow text-[#72f1b8]">A reusable WebMCP accessibility pattern</p>
            <h2>No site tool plays for you.<br /><span>The agent helps the game listen.</span></h2>
            <p>MCPilot is a working reference for inclusive web games: evidence carries its limits, capabilities register only after player decisions, and every tune stays reversible.</p>
          </div>
          <div className="principle-cards">
            <article><span>01</span><h3>Shared live state</h3><p>The human sees the same trial, settings, and results the agent acts on.</p></article>
            <article><span>02</span><h3>Approval is code</h3><p>The apply tool exists only after visible approval, then disappears.</p></article>
            <article><span>03</span><h3>The check-in can veto</h3><p>A real comparison waits for a visible UI check-in; sample data can never support an outcome claim.</p></article>
          </div>
        </section>

        <footer>
          <span>MCPILOT · ADAPTIVE INTERACTIVE PLAY LAB</span>
          <span>Game state local-first · Optional voice streams only while connected · No autonomous-play site tool</span>
        </footer>
      </div>

      {settingsOpen && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeSettings(); }}>
          <section ref={settingsDialogRef} className="settings-drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1}>
            <div className="drawer-heading">
              <div><p className="eyebrow text-[#72f1b8]">Human interface</p><h2 id="settings-title">Player controls</h2></div>
              <button type="button" onClick={closeSettings} aria-label="Close player controls">×</button>
            </div>
            <p className="drawer-intro">Every agent-facing action has a human-facing equivalent. Change anything here without an agent.</p>

            <fieldset>
              <legend>Control layout</legend>
              <div className="segmented-grid">
                {(Object.keys(controlLabels) as ControlMode[]).map((value) => (
                  <button aria-pressed={settings.controlMode === value} className={settings.controlMode === value ? 'is-active' : ''} type="button" key={value} disabled={isTrialActive} onClick={() => patchSettings({ controlMode: value })}>{controlLabels[value]}</button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Motion</legend>
              <div className="segmented-grid three">
                {(Object.keys(motionLabels) as MotionMode[]).map((value) => (
                  <button aria-pressed={settings.motion === value} className={settings.motion === value ? 'is-active' : ''} type="button" key={value} disabled={isTrialActive} onClick={() => patchSettings({ motion: value })}>{motionLabels[value]}</button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Contrast</legend>
              <div className="segmented-grid three">
                {(Object.keys(contrastLabels) as ContrastMode[]).map((value) => (
                  <button aria-pressed={settings.contrast === value} className={settings.contrast === value ? 'is-active' : ''} type="button" key={value} disabled={isTrialActive} onClick={() => patchSettings({ contrast: value })}>{contrastLabels[value]}</button>
                ))}
              </div>
            </fieldset>

            {([
              ['gameSpeed', 'Game pace', settings.gameSpeed, 0.6, 1.25, 0.05],
              ['targetScale', 'Target size', settings.targetScale, 1, 1.8, 0.1],
              ['steeringAssist', 'Steering assist', settings.steeringAssist, 0, 0.65, 0.05],
              ['collisionForgiveness', 'Collision forgiveness', settings.collisionForgiveness, 0, 0.55, 0.05],
            ] as Array<[keyof Settings, string, number, number, number, number]>).map(([key, label, value, min, max, step]) => (
              <label className="range-setting" key={key}>
                <span><b>{label}</b><SettingValue settingKey={key} value={value} /></span>
                <input type="range" min={min} max={max} step={step} value={value} disabled={isTrialActive} onChange={(event) => patchSettings({ [key]: Number(event.target.value) } as Partial<Settings>)} />
              </label>
            ))}

            <label className="toggle-setting">
              <span><b>Audio cues</b><small>Distinct tones for signals and collisions.</small></span>
              <input
                type="checkbox"
                checked={settings.audioCues}
                disabled={isTrialActive}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  patchSettings({ audioCues: enabled });
                  if (enabled) void ensureAudioContext().then((context) => { if (context) playTone(520, 0.08); });
                }}
              />
            </label>

            <div className="drawer-actions">
              {undoSettings && <button className="decline-button" type="button" onClick={() => undoTune('player')}>Undo agent tune</button>}
              <button className="approve-button" type="button" onClick={closeSettings}>Done</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
