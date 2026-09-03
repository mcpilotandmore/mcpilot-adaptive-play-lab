import {
  ADAPTATION_CATALOG,
  compareSessions,
  deriveSignals,
  isPendingPlayedAdaptedSession,
} from './core.mjs';

export const TOOL_DESCRIPTION_LIMIT = 500;
export const PARAMETER_DESCRIPTION_LIMIT = 150;
export const TOOL_NAME_LIMIT = 30;
export const TOOL_OUTPUT_LIMIT = 1500;

export const BASE_TOOL_NAMES = Object.freeze([
  'inspect_play_lab',
  'read_play_signals',
  'list_adaptations',
  'propose_access_tune',
  'load_sample_baseline',
  'export_access_preset',
]);

const EMPTY_INPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: Object.freeze({}),
  additionalProperties: false,
});

const READ_SIGNALS_INPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: Object.freeze({
    sessionId: Object.freeze({
      type: 'string',
      description: 'Completed session ID. Omit for the latest trial.',
    }),
  }),
  additionalProperties: false,
});

const PROPOSE_TUNE_INPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: Object.freeze({
    rationale: Object.freeze({
      type: 'string',
      minLength: 12,
      maxLength: 420,
      description: 'Evidence-based reason for this narrow change set.',
    }),
    preserveChallenge: Object.freeze({
      type: 'string',
      minLength: 8,
      maxLength: 240,
      description: 'Skill or challenge that remains player-controlled.',
    }),
    changes: Object.freeze({
      type: 'object',
      description: 'One or more bounded settings to include in the visible plan.',
      properties: Object.freeze({
        controlMode: Object.freeze({ type: 'string', enum: Object.freeze(['two-hand', 'one-hand-left', 'one-hand-right', 'single-switch']), description: 'Input layout. Single-switch rotates continuous movement with one action.' }),
        motion: Object.freeze({ type: 'string', enum: Object.freeze(['full', 'reduced', 'none']), description: 'Decorative motion level; play state remains visible in every mode.' }),
        contrast: Object.freeze({ type: 'string', enum: Object.freeze(['standard', 'high', 'monochrome']), description: 'Visual contrast and shape treatment without hiding game information.' }),
        gameSpeed: Object.freeze({ type: 'number', minimum: 0.6, maximum: 1.25, multipleOf: 0.05, description: 'Movement and hazard pace multiplier in 0.05 steps; lower allows more response time.' }),
        targetScale: Object.freeze({ type: 'number', minimum: 1, maximum: 1.8, multipleOf: 0.1, description: 'Signal hit-area scale in 0.1 steps; 1 is default and 1.8 is largest.' }),
        steeringAssist: Object.freeze({ type: 'number', minimum: 0, maximum: 0.65, multipleOf: 0.05, description: 'Gentle pull toward the nearest signal in 0.05 steps; 0 disables assistance.' }),
        collisionForgiveness: Object.freeze({ type: 'number', minimum: 0, maximum: 0.55, multipleOf: 0.05, description: 'Collision-zone reduction in 0.05 steps; hazards remain visible and active.' }),
        audioCues: Object.freeze({ type: 'boolean', description: 'Whether collection and collision events emit distinct local tones.' }),
      }),
      minProperties: 1,
      additionalProperties: false,
    }),
  }),
  required: Object.freeze(['rationale', 'preserveChallenge', 'changes']),
  additionalProperties: false,
});

const APPLY_TUNE_INPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: Object.freeze({
    proposalId: Object.freeze({
      type: 'string',
      minLength: 1,
      description: 'Exact approved proposal ID shown by the page.',
    }),
  }),
  required: Object.freeze(['proposalId']),
  additionalProperties: false,
});

const makeToolError = (code, message) => {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
};

const assertActive = (signal) => {
  if (!signal?.aborted) return;
  const error = new Error('Tool call canceled before completion.');
  error.name = 'AbortError';
  throw error;
};

const isPlainObject = (value) => Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value);

const validateInput = (schema, value, path = 'input') => {
  if (!schema) return;
  if (schema.type === 'object') {
    if (!isPlainObject(value)) throw makeToolError('INVALID_INPUT', `${path} must be an object.`);
    const properties = schema.properties ?? {};
    const keys = Object.keys(value);
    if (schema.additionalProperties === false) {
      const unknown = keys.filter((key) => !Object.hasOwn(properties, key));
      if (unknown.length) {
        throw makeToolError('INVALID_INPUT', `${path} contains unsupported fields: ${unknown.join(', ')}.`);
      }
    }
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) {
        throw makeToolError('INVALID_INPUT', `${path}.${required} is required.`);
      }
    }
    if (schema.minProperties && keys.length < schema.minProperties) {
      throw makeToolError('INVALID_INPUT', `${path} requires at least ${schema.minProperties} field.`);
    }
    for (const key of keys) validateInput(properties[key], value[key], `${path}.${key}`);
    return;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') throw makeToolError('INVALID_INPUT', `${path} must be a string.`);
    if (schema.minLength && value.length < schema.minLength) {
      throw makeToolError('INVALID_INPUT', `${path} must contain at least ${schema.minLength} characters.`);
    }
    if (schema.maxLength && value.length > schema.maxLength) {
      throw makeToolError('INVALID_INPUT', `${path} must contain at most ${schema.maxLength} characters.`);
    }
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw makeToolError('INVALID_INPUT', `${path} must be a finite number.`);
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw makeToolError('INVALID_INPUT', `${path} must be at least ${schema.minimum}.`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      throw makeToolError('INVALID_INPUT', `${path} must be at most ${schema.maximum}.`);
    }
    if (schema.multipleOf !== undefined) {
      const units = value / schema.multipleOf;
      if (Math.abs(units - Math.round(units)) > 1e-8) {
        throw makeToolError('INVALID_INPUT', `${path} must use increments of ${schema.multipleOf}.`);
      }
    }
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') {
    throw makeToolError('INVALID_INPUT', `${path} must be a boolean.`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    throw makeToolError('INVALID_INPUT', `${path} must be one of: ${schema.enum.join(', ')}.`);
  }
};

const assertOutputBudget = (name, result) => {
  const serialized = JSON.stringify(result);
  if (serialized.length > TOOL_OUTPUT_LIMIT) {
    throw makeToolError(
      'OUTPUT_LIMIT',
      `${name} produced ${serialized.length} characters; the limit is ${TOOL_OUTPUT_LIMIT}.`,
    );
  }
  return result;
};

const wrapExecution = (name, onCall, onError, execute, inputSchema, tracker) => async (input = {}, options = {}) => {
  try {
    assertActive(options.signal);
    validateInput(inputSchema, input);
    const run = async () => {
      const result = await execute(input, options);
      const bounded = assertOutputBudget(name, result);
      onCall?.(name);
      return bounded;
    };
    return tracker ? tracker.run(run) : run();
  } catch (error) {
    if (error?.name !== 'AbortError') onError?.(name, error);
    throw error;
  }
};

export const settingsFingerprint = (settings) => JSON.stringify([
  settings.controlMode,
  settings.motion,
  settings.contrast,
  settings.gameSpeed,
  settings.targetScale,
  settings.steeringAssist,
  settings.collisionForgiveness,
  settings.audioCues,
]);

export function getDiscoverableToolNames({
  proposalStatus,
  proposalStale = false,
  comparisonReady = false,
  hasUndo = false,
}) {
  return [
    ...BASE_TOOL_NAMES,
    ...(proposalStatus === 'approved' && !proposalStale ? ['apply_approved_tune'] : []),
    ...(comparisonReady ? ['compare_play_trials'] : []),
    ...(hasUndo ? ['undo_last_tune'] : []),
  ];
}

export function createToolExecutionTracker() {
  let activeCalls = 0;
  const deferredControllers = new Set();
  return {
    async run(execute) {
      activeCalls += 1;
      try {
        return await execute();
      } finally {
        activeCalls -= 1;
        if (activeCalls === 0) {
          for (const controller of deferredControllers) controller.abort();
          deferredControllers.clear();
        }
      }
    },
    abortWhenIdle(controller) {
      if (activeCalls === 0) controller.abort();
      else deferredControllers.add(controller);
    },
    get activeCalls() {
      return activeCalls;
    },
  };
}

export function createBaseTools({ actions, getState, onCall, onError, tracker }) {
  return [
    {
      name: 'inspect_play_lab',
      title: 'Inspect play lab',
      description: 'Read the current trial state, player-selected needs, active settings, and next human review step. Makes no changes.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, untrustedContentHint: true },
      execute: wrapExecution('inspect_play_lab', onCall, onError, () => actions.inspectLab(), EMPTY_INPUT_SCHEMA, tracker),
    },
    {
      name: 'read_play_signals',
      title: 'Read play signals',
      description: 'Analyze one completed local trial with provenance; not a diagnosis. Played adapted metrics stay withheld until the visible player check-in is answered or skipped.',
      inputSchema: READ_SIGNALS_INPUT_SCHEMA,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, untrustedContentHint: true },
      execute: wrapExecution('read_play_signals', onCall, onError, (input) => {
        const sessions = getState().sessions;
        const id = typeof input.sessionId === 'string' ? input.sessionId : undefined;
        const session = id
          ? sessions.find((item) => item.id === id)
          : sessions.at(-1);
        if (!session) {
          throw makeToolError(
            'MISSING_STATE',
            'No completed trial is available. Ask the player to play or explicitly offer the sample baseline.',
          );
        }
        if (isPendingPlayedAdaptedSession(session, sessions)) {
          throw makeToolError(
            'PLAYER_CHECK_IN_REQUIRED',
            'Adapted-trial metrics remain withheld from site tools until the visible player check-in is answered or skipped.',
          );
        }
        return deriveSignals(session);
      }, READ_SIGNALS_INPUT_SCHEMA, tracker),
    },
    {
      name: 'list_adaptations',
      title: 'List adaptations',
      description: 'Read every supported, reversible game adaptation with allowed values and player-facing behavior.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      execute: wrapExecution('list_adaptations', onCall, onError, () => ({
        adaptations: ADAPTATION_CATALOG,
        rule: 'Prefer the smallest evidence-backed change set.',
      }), EMPTY_INPUT_SCHEMA, tracker),
    },
    {
      name: 'propose_access_tune',
      title: 'Propose accessibility tune',
      description: 'Draft a visible, reversible settings plan for player review. This does not activate settings or replace any visible plan. State the evidence and preserved challenge.',
      inputSchema: PROPOSE_TUNE_INPUT_SCHEMA,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, untrustedContentHint: true },
      execute: wrapExecution('propose_access_tune', onCall, onError, (input) => actions.proposeTune(input), PROPOSE_TUNE_INPUT_SCHEMA, tracker),
    },
    {
      name: 'load_sample_baseline',
      title: 'Load sample baseline',
      description: 'Load one clearly labeled fictional baseline for a no-telemetry demo. Changes local demo state only.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, untrustedContentHint: true },
      execute: wrapExecution('load_sample_baseline', onCall, onError, () => actions.loadSampleBaseline(), EMPTY_INPUT_SCHEMA, tracker),
    },
    {
      name: 'export_access_preset',
      title: 'Export access preset',
      description: 'Read the active settings as portable JSON. Does not download, publish, or change anything.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, untrustedContentHint: true },
      execute: wrapExecution('export_access_preset', onCall, onError, () => {
        const state = getState();
        return {
          format: 'second-player-preset/v1',
          settings: state.settings,
          playerSelectedNeeds: state.selectedNeeds,
          note: 'Portable preferences only; no medical or identity information.',
        };
      }, EMPTY_INPUT_SCHEMA, tracker),
    },
  ];
}

export function createApplyTool({ getProposal, apply, onCall, onError, tracker }) {
  return {
    name: 'apply_approved_tune',
    title: 'Apply approved tune',
    description: 'Activate the exact visible plan already approved by the player. Rejects stale settings, player-intent drift, changed IDs, or replay and keeps one undo snapshot.',
    inputSchema: APPLY_TUNE_INPUT_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, untrustedContentHint: true },
    execute: wrapExecution('apply_approved_tune', onCall, onError, (input) => {
      if (typeof input.proposalId !== 'string' || !input.proposalId) {
        throw makeToolError('INVALID_INPUT', 'proposalId is required.');
      }
      const proposal = getProposal();
      if (!proposal || proposal.status !== 'approved') {
        throw makeToolError(
          'STATE_CONFLICT',
          'No player-approved plan is ready. Wait for visible player approval.',
        );
      }
      if (input.proposalId !== proposal.id) {
        throw makeToolError('STALE_PROPOSAL', 'proposalId does not match the current approved plan.');
      }
      return apply(input.proposalId);
    }, APPLY_TUNE_INPUT_SCHEMA, tracker),
  };
}

export function createCompareTool({ getSessions, getExpectedLineage, onCall, onError, tracker }) {
  return {
    name: 'compare_play_trials',
    title: 'Compare play trials',
    description: 'Compare an exact baseline/adapted lineage. Carries source and course provenance; played pairs wait for the visible player check-in. Makes no changes.',
    inputSchema: EMPTY_INPUT_SCHEMA,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, untrustedContentHint: true },
    execute: wrapExecution('compare_play_trials', onCall, onError, () => {
      const sessions = getSessions();
      const lineage = getExpectedLineage?.();
      if (
        !lineage
        || typeof lineage.baselineId !== 'string'
        || typeof lineage.baselineSettingsFingerprint !== 'string'
        || typeof lineage.proposalId !== 'string'
        || typeof lineage.appliedSettingsFingerprint !== 'string'
      ) {
        throw makeToolError('MISSING_STATE', 'No complete applied-tune lineage is available to compare.');
      }
      const baseline = [...sessions].reverse().find((item) => (
        item.mode === 'baseline'
        && item.id === lineage.baselineId
        && item.settingsFingerprint === lineage.baselineSettingsFingerprint
      ));
      const adapted = baseline
        ? [...sessions].reverse().find((item) => (
            item.mode === 'adapted'
            && item.baselineId === baseline.id
            && item.appliedProposalId === lineage.proposalId
            && item.settingsFingerprint === lineage.appliedSettingsFingerprint
          ))
        : null;
      if (!baseline || !adapted) {
        throw makeToolError('MISSING_STATE', 'The baseline and adapted trial must match the exact applied plan and settings snapshots.');
      }
      return compareSessions(baseline, adapted);
    }, EMPTY_INPUT_SCHEMA, tracker),
  };
}

export function createUndoTool({ undo, onCall, onError, tracker }) {
  return {
    name: 'undo_last_tune',
    title: 'Undo last tune',
    description: 'Restore the settings snapshot from immediately before the last applied tune. This is a visible, reversible state change.',
    inputSchema: EMPTY_INPUT_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, untrustedContentHint: true },
    execute: wrapExecution('undo_last_tune', onCall, onError, () => undo(), EMPTY_INPUT_SCHEMA, tracker),
  };
}

export async function registerToolOnce(context, tool, signal) {
  assertActive(signal);
  await context.registerTool(tool, { signal });
}

export async function registerToolSet(context, tools, signal) {
  for (const tool of tools) await registerToolOnce(context, tool, signal);
}

const visitParameterDescriptions = (schema, issues, path = 'inputSchema') => {
  if (!schema || typeof schema !== 'object') return;
  if (typeof schema.description === 'string' && schema.description.length > PARAMETER_DESCRIPTION_LIMIT) {
    issues.push(`${path}.description exceeds ${PARAMETER_DESCRIPTION_LIMIT} characters`);
  }
  if (schema.properties && typeof schema.properties === 'object') {
    for (const [name, value] of Object.entries(schema.properties)) {
      if (name.length > TOOL_NAME_LIMIT) issues.push(`${path}.${name} exceeds ${TOOL_NAME_LIMIT} characters`);
      visitParameterDescriptions(value, issues, `${path}.${name}`);
    }
  }
};

export function validateToolContract(tools) {
  const issues = [];
  const names = new Set();
  for (const tool of tools) {
    if (names.has(tool.name)) issues.push(`duplicate tool name: ${tool.name}`);
    names.add(tool.name);
    if (tool.name.length > TOOL_NAME_LIMIT) issues.push(`${tool.name} exceeds ${TOOL_NAME_LIMIT} characters`);
    if (tool.description.length > TOOL_DESCRIPTION_LIMIT) {
      issues.push(`${tool.name} description exceeds ${TOOL_DESCRIPTION_LIMIT} characters`);
    }
    if (tool.inputSchema?.additionalProperties !== false) {
      issues.push(`${tool.name} inputSchema must reject additional properties`);
    }
    visitParameterDescriptions(tool.inputSchema, issues, `${tool.name}.inputSchema`);
  }
  return issues;
}
