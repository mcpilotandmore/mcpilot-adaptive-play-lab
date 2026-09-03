import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  applyTune,
  createSampleBaseline,
  createSampleTuned,
} from '../app/core.mjs';
import {
  BASE_TOOL_NAMES,
  TOOL_OUTPUT_LIMIT,
  createApplyTool,
  createBaseTools,
  createCompareTool,
  createToolExecutionTracker,
  createUndoTool,
  getDiscoverableToolNames,
  registerToolOnce,
  registerToolSet,
  settingsFingerprint,
  validateToolContract,
} from '../app/webmcp-contract.mjs';

const makeBaseTools = (overrides = {}) => {
  const state = overrides.state ?? {
    settings: { ...DEFAULT_SETTINGS },
    sessions: [createSampleBaseline()],
    selectedNeeds: ['one-hand', 'motion'],
  };
  const actions = {
    inspectLab: () => ({
      product: 'MCPilot Adaptive Interactive Play Lab',
      phase: 'idle',
      selectedNeeds: state.selectedNeeds,
      activeSettings: state.settings,
      latestSession: { id: 'sample-baseline', mode: 'baseline', source: 'sample', score: 55 },
      proposal: null,
      nextHumanStep: 'Use the evidence to propose a narrow, reversible tune.',
    }),
    proposeTune: (input) => ({ status: 'awaiting_player_approval', proposalId: 'plan-test', input }),
    loadSampleBaseline: () => ({ status: 'loaded_sample_data', sessionId: 'sample-baseline' }),
    ...overrides.actions,
  };
  return createBaseTools({
    actions,
    getState: () => state,
    onCall: overrides.onCall,
    onError: overrides.onError,
    tracker: overrides.tracker,
  });
};

const byName = (tools, name) => {
  const tool = tools.find((item) => item.name === name);
  assert.ok(tool, `missing tool ${name}`);
  return tool;
};

test('all nine tool variants satisfy the strict contract', () => {
  const base = makeBaseTools();
  const proposal = { id: 'plan-test', status: 'approved' };
  const tools = [
    ...base,
    createApplyTool({ getProposal: () => proposal, apply: () => ({ status: 'applied' }) }),
    createCompareTool({ getSessions: () => [] }),
    createUndoTool({ undo: () => ({ status: 'restored' }) }),
  ];

  assert.deepEqual(validateToolContract(tools), []);
  assert.equal(new Set(tools.map((tool) => tool.name)).size, tools.length);
  assert.deepEqual(base.map((tool) => tool.name), BASE_TOOL_NAMES);
  assert.ok(tools.every((tool) => !/check.?in|player.?outcome|reflection/i.test(tool.name)), 'player check-in must have no agent mutation tool');
});

test('proposal fields and local mutations are planner-explicit', () => {
  const base = makeBaseTools();
  const propose = byName(base, 'propose_access_tune');
  const changeProperties = propose.inputSchema.properties.changes.properties;
  assert.ok(Object.values(changeProperties).every((schema) => schema.description?.length > 0));

  const mutations = [
    propose,
    byName(base, 'load_sample_baseline'),
    createApplyTool({ getProposal: () => ({ id: 'plan-test', status: 'approved' }), apply: () => ({ status: 'applied' }) }),
    createUndoTool({ undo: () => ({ status: 'restored' }) }),
  ];
  for (const tool of mutations) {
    assert.equal(tool.annotations.readOnlyHint, false, tool.name);
    assert.equal(tool.annotations.destructiveHint, false, tool.name);
    assert.equal(tool.annotations.idempotentHint, false, tool.name);
    assert.equal(tool.annotations.openWorldHint, false, tool.name);
  }

  for (const tool of base.filter((item) => item.annotations.readOnlyHint)) {
    assert.equal(tool.annotations.idempotentHint, undefined, `${tool.name} logs a visible audit row`);
  }
});

test('discoverability follows approval, evidence, and undo state', () => {
  assert.deepEqual(getDiscoverableToolNames({}), BASE_TOOL_NAMES);
  assert.deepEqual(
    getDiscoverableToolNames({ proposalStatus: 'approved' }),
    [...BASE_TOOL_NAMES, 'apply_approved_tune'],
  );
  assert.ok(!getDiscoverableToolNames({ proposalStatus: 'approved', proposalStale: true })
    .includes('apply_approved_tune'));
  assert.deepEqual(
    getDiscoverableToolNames({ proposalStatus: 'applied', comparisonReady: true, hasUndo: true }),
    [...BASE_TOOL_NAMES, 'compare_play_trials', 'undo_last_tune'],
  );
  assert.ok(!getDiscoverableToolNames({ proposalStatus: 'applied', comparisonReady: false })
    .includes('compare_play_trials'));
});

test('runtime validation rejects extra, missing, nested, and out-of-range inputs', async () => {
  const tools = makeBaseTools();
  const inspect = byName(tools, 'inspect_play_lab');
  const propose = byName(tools, 'propose_access_tune');

  await assert.rejects(inspect.execute({ surprise: true }), /INVALID_INPUT.*unsupported fields/);
  await assert.rejects(propose.execute({}), /INVALID_INPUT.*rationale is required/);
  await assert.rejects(propose.execute({
    rationale: 'A sufficiently long evidence statement.',
    preserveChallenge: 'Keep active navigation.',
    changes: { gameSpeed: 0.8, hiddenMode: true },
  }), /INVALID_INPUT.*hiddenMode/);
  await assert.rejects(propose.execute({
    rationale: 'A sufficiently long evidence statement.',
    preserveChallenge: 'Keep active navigation.',
    changes: { gameSpeed: 9 },
  }), /INVALID_INPUT.*at most 1.25/);
  await assert.rejects(propose.execute({
    rationale: 'A sufficiently long evidence statement.',
    preserveChallenge: 'Keep active navigation.',
    changes: { gameSpeed: 0.63 },
  }), /INVALID_INPUT.*increments of 0.05/);
  await assert.rejects(propose.execute({
    rationale: 'too short',
    preserveChallenge: 'Keep active navigation.',
    changes: { gameSpeed: 0.8 },
  }), /INVALID_INPUT.*at least 12/);
});

test('rejected calls emit an audit outcome without being counted as success', async () => {
  const successes = [];
  const failures = [];
  const tools = makeBaseTools({
    onCall: (name) => successes.push(name),
    onError: (name, error) => failures.push({ name, message: error.message }),
  });

  await assert.rejects(byName(tools, 'inspect_play_lab').execute({ extra: true }), /INVALID_INPUT/);
  assert.deepEqual(successes, []);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].name, 'inspect_play_lab');
  assert.match(failures[0].message, /unsupported fields/);
});

test('representative read outputs stay within the agent-facing budget', async () => {
  const productionShapedInspect = {
    product: 'MCPilot Adaptive Interactive Play Lab',
    phase: 'complete',
    selectedNeeds: ['one-hand', 'fine-motor', 'motion', 'contrast', 'response'],
    activeSettings: {
      controlMode: 'single-switch',
      motion: 'none',
      contrast: 'monochrome',
      gameSpeed: 0.6,
      targetScale: 1.8,
      steeringAssist: 0.65,
      collisionForgiveness: 0.55,
      audioCues: true,
    },
    latestSession: {
      id: 'played-adapted-maximum-length',
      mode: 'adapted',
      source: 'played',
      courseId: 'signal-course-v1',
      evidenceGrade: 'played_trial',
      playerCheckIn: {
        status: 'answered',
        outcome: 'better',
        baselineId: 'played-baseline-maximum-length',
        capturedVia: 'visible_player_ui',
        recordedAt: '2026-08-31T23:59:59.999Z',
      },
      metricsWithheld: false,
      score: 1395,
      accuracyPercent: 86,
      signalCodes: ['steady_play'],
    },
    proposal: {
      id: 'plan-production-shaped-maximum-length',
      status: 'applied',
      stale: false,
      baselineEvidenceGrade: 'played_trial',
      courseId: 'signal-course-v1',
      selectedNeeds: ['one-hand', 'fine-motor', 'motion', 'contrast', 'response'],
      changedSettings: [
        'controlMode',
        'motion',
        'contrast',
        'gameSpeed',
        'targetScale',
        'steeringAssist',
        'collisionForgiveness',
        'audioCues',
      ],
    },
    comparisonEvidence: {
      evidenceGrade: 'played_pair_player_reported',
      claimableOutcome: true,
      playerCheckInStatus: 'answered',
    },
    nextHumanStep: 'Compare the matched baseline and adapted trials.',
  };
  const tools = makeBaseTools({ actions: { inspectLab: () => productionShapedInspect } });
  for (const name of ['inspect_play_lab', 'read_play_signals', 'list_adaptations', 'export_access_preset']) {
    const result = await byName(tools, name).execute({});
    assert.ok(JSON.stringify(result).length <= TOOL_OUTPUT_LIMIT, `${name} exceeded output budget`);
  }
});

test('signal reads redact a pending played adapted trial by default and by id', async () => {
  const baseline = { ...createSampleBaseline(), source: 'played' };
  const adapted = {
    ...createSampleTuned(applyTune(DEFAULT_SETTINGS, { gameSpeed: 0.8 })),
    id: 'pending-adapted',
    source: 'played',
    baselineId: baseline.id,
    appliedProposalId: 'plan-pending',
    settingsFingerprint: 'pending-fingerprint',
  };
  const tools = makeBaseTools({
    state: {
      settings: { ...DEFAULT_SETTINGS },
      sessions: [baseline, adapted],
      selectedNeeds: ['one-hand'],
    },
  });
  const read = byName(tools, 'read_play_signals');

  await assert.rejects(read.execute({}), /PLAYER_CHECK_IN_REQUIRED.*withheld/);
  await assert.rejects(read.execute({ sessionId: adapted.id }), /PLAYER_CHECK_IN_REQUIRED.*withheld/);
  const baselineReport = await read.execute({ sessionId: baseline.id });
  assert.equal(baselineReport.sessionId, baseline.id);

  const sampleBaseline = createSampleBaseline();
  const sampleMixedAdapted = { ...adapted, baselineId: sampleBaseline.id };
  const demoTools = makeBaseTools({
    state: {
      settings: { ...DEFAULT_SETTINGS },
      sessions: [sampleBaseline, sampleMixedAdapted],
      selectedNeeds: ['one-hand'],
    },
  });
  const demoReport = await byName(demoTools, 'read_play_signals').execute({});
  assert.equal(demoReport.sessionId, sampleMixedAdapted.id);
});

test('oversized outputs fail closed and are not logged as successful calls', async () => {
  const calls = [];
  const tools = makeBaseTools({
    actions: { inspectLab: () => ({ payload: 'x'.repeat(TOOL_OUTPUT_LIMIT + 1) }) },
    onCall: (name) => calls.push(name),
  });

  await assert.rejects(byName(tools, 'inspect_play_lab').execute({}), /OUTPUT_LIMIT/);
  assert.deepEqual(calls, []);
});

test('an already canceled invocation cannot mutate state', async () => {
  let mutations = 0;
  const controller = new AbortController();
  controller.abort();
  const tool = createUndoTool({ undo: () => { mutations += 1; } });

  await assert.rejects(tool.execute({}, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(mutations, 0);
});

test('registration cleanup waits for an in-flight execution to settle', async () => {
  const tracker = createToolExecutionTracker();
  const controller = new AbortController();
  let release;
  const pending = tracker.run(() => new Promise((resolve) => { release = resolve; }));

  assert.equal(tracker.activeCalls, 1);
  tracker.abortWhenIdle(controller);
  assert.equal(controller.signal.aborted, false);
  release('done');
  assert.equal(await pending, 'done');
  assert.equal(controller.signal.aborted, true);
  assert.equal(tracker.activeCalls, 0);
});

test('apply requires the exact approved revision and cannot be replayed', async () => {
  let proposal = { id: 'plan-exact', status: 'approved' };
  let applications = 0;
  const tool = createApplyTool({
    getProposal: () => proposal,
    apply: (proposalId) => {
      applications += 1;
      proposal = { ...proposal, status: 'applied' };
      return { status: 'applied', proposalId };
    },
  });

  await assert.rejects(tool.execute({ proposalId: 'plan-old' }), /STALE_PROPOSAL/);
  assert.equal(applications, 0);
  assert.deepEqual(await tool.execute({ proposalId: 'plan-exact' }), {
    status: 'applied',
    proposalId: 'plan-exact',
  });
  assert.equal(applications, 1);
  await assert.rejects(tool.execute({ proposalId: 'plan-exact' }), /STATE_CONFLICT/);
  assert.equal(applications, 1);
});

test('comparison rejects unrelated evidence and accepts matched lineage', async () => {
  const baseline = { ...createSampleBaseline(), source: 'played' };
  const adapted = {
    ...createSampleTuned(applyTune(DEFAULT_SETTINGS, { gameSpeed: 0.8 })),
    source: 'played',
    baselineId: 'different-baseline',
    appliedProposalId: 'plan-test',
    settingsFingerprint: 'applied-fingerprint',
    playerCheckIn: {
      status: 'skipped',
      outcome: null,
      baselineId: baseline.id,
      capturedVia: 'visible_player_ui',
      recordedAt: '2026-08-26T12:00:00.000Z',
    },
  };
  let sessions = [baseline, adapted];
  let lineage = {
    baselineId: baseline.id,
    baselineSettingsFingerprint: 'baseline-fingerprint',
    proposalId: 'plan-test',
    appliedSettingsFingerprint: 'applied-fingerprint',
  };
  const stampedBaseline = { ...baseline, settingsFingerprint: 'baseline-fingerprint' };
  sessions = [stampedBaseline, adapted];
  const tool = createCompareTool({
    getSessions: () => sessions,
    getExpectedLineage: () => lineage,
  });

  await assert.rejects(tool.execute({}), /MISSING_STATE/);
  sessions = [stampedBaseline, { ...adapted, baselineId: baseline.id, appliedProposalId: 'wrong-plan' }];
  await assert.rejects(tool.execute({}), /MISSING_STATE/);
  sessions = [stampedBaseline, { ...adapted, baselineId: baseline.id, settingsFingerprint: 'tampered' }];
  await assert.rejects(tool.execute({}), /MISSING_STATE/);
  sessions = [stampedBaseline, { ...adapted, baselineId: baseline.id }];
  const result = await tool.execute({});
  assert.equal(result.baselineId, baseline.id);
  assert.equal(result.tunedId, adapted.id);

  lineage = null;
  await assert.rejects(tool.execute({}), /MISSING_STATE/);
});

test('partial registration can be revoked as one fail-closed set', async () => {
  const controller = new AbortController();
  const seen = [];
  const context = {
    async registerTool(tool, options) {
      seen.push({ name: tool.name, signal: options.signal });
      if (seen.length === 3) throw new Error('registration failed');
    },
  };

  await assert.rejects(registerToolSet(context, makeBaseTools(), controller.signal), /registration failed/);
  controller.abort();
  assert.equal(seen.length, 3);
  assert.ok(seen.every((item) => item.signal.aborted));
});

test('single-tool registration converts synchronous failure into a retryable rejection', async () => {
  const controller = new AbortController();
  let attempts = 0;
  const context = {
    registerTool() {
      attempts += 1;
      if (attempts === 1) throw new Error('transient registration failure');
      return Promise.resolve();
    },
  };
  const tool = { name: 'apply_approved_tune' };

  await assert.rejects(registerToolOnce(context, tool, controller.signal), /transient registration failure/);
  await assert.doesNotReject(registerToolOnce(context, tool, controller.signal));
  assert.equal(attempts, 2);
});

test('settings fingerprints change on every supported setting dimension', () => {
  const original = settingsFingerprint(DEFAULT_SETTINGS);
  for (const [key, next] of Object.entries({
    controlMode: 'one-hand-left',
    motion: 'reduced',
    contrast: 'high',
    gameSpeed: 0.8,
    targetScale: 1.4,
    steeringAssist: 0.2,
    collisionForgiveness: 0.2,
    audioCues: true,
  })) {
    assert.notEqual(settingsFingerprint({ ...DEFAULT_SETTINGS, [key]: next }), original, key);
  }
});
