import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkInLabel,
  formatMetricTable,
  validatePackRelease,
} from './submission-data.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const templateDirectory = resolve(scriptDirectory, '..', 'submission', 'templates');

export const READY_FILES = Object.freeze({
  'DEVPOST.md.tmpl': 'DEVPOST.md',
  'YOUTUBE_TITLE.txt.tmpl': 'YOUTUBE_TITLE.txt',
  'YOUTUBE_DESCRIPTION.txt.tmpl': 'YOUTUBE_DESCRIPTION.txt',
  'GALLERY_COPY.md.tmpl': 'GALLERY_COPY.md',
  'README_RELEASE_BLOCK.md.tmpl': 'README_RELEASE_BLOCK.md',
  'DEMO_CAPTIONS.srt.tmpl': 'DEMO_CAPTIONS.srt',
});

const normalizeOutput = (value) => `${value.replace(/\r\n?/g, '\n').trimEnd()}\n`;

const audioStatusLabel = (status) => ({
  human_confirmed: 'human confirmed',
  instrumented_only: 'instrumented only',
  not_tested: 'not tested',
}[status]);

const compactMetricHeadline = (row) => `${row.label}: ${row.before} → ${row.after} (${row.delta}).`;

const renderTemplate = (template, values, templateName) => {
  const referenced = [...template.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((match) => match[1]);
  const missing = [...new Set(referenced)].filter((key) => !Object.hasOwn(values, key));
  if (missing.length) {
    return { error: `${templateName} references unknown tokens: ${missing.join(', ')}` };
  }
  const output = normalizeOutput(template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => values[key]));
  const unresolved = [...output.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]);
  if (unresolved.length) {
    return { error: `${templateName} has unresolved tokens: ${[...new Set(unresolved)].join(', ')}` };
  }
  return { output };
};

const srtTimeToMs = (value) => {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/);
  if (!match) return null;
  const [, hours, minutes, seconds, milliseconds] = match.map(Number);
  if (minutes > 59 || seconds > 59) return null;
  return (((hours * 60) + minutes) * 60 + seconds) * 1000 + milliseconds;
};

export function validateSrt(contents, runtimeSeconds) {
  const errors = [];
  const blocks = contents.trim().split(/\n{2,}/);
  let previousEnd = 0;

  blocks.forEach((block, index) => {
    const lines = block.split('\n');
    const expectedIndex = index + 1;
    if (lines[0] !== String(expectedIndex)) {
      errors.push(`Caption block ${expectedIndex} must use sequential cue number ${expectedIndex}`);
    }
    const timing = lines[1]?.match(/^(\S+) --> (\S+)$/);
    if (!timing) {
      errors.push(`Caption block ${expectedIndex} has an invalid timing line`);
      return;
    }
    const start = srtTimeToMs(timing[1]);
    const end = srtTimeToMs(timing[2]);
    if (start === null || end === null || start >= end) {
      errors.push(`Caption block ${expectedIndex} has invalid start/end times`);
      return;
    }
    if (start < previousEnd) errors.push(`Caption block ${expectedIndex} overlaps the previous cue`);
    previousEnd = end;

    const textLines = lines.slice(2);
    if (textLines.length < 1 || textLines.length > 2) {
      errors.push(`Caption block ${expectedIndex} must contain one or two text lines`);
    }
    textLines.forEach((line, lineIndex) => {
      if ([...line].length > 42) {
        errors.push(`Caption block ${expectedIndex} line ${lineIndex + 1} exceeds 42 characters`);
      }
      if (!line.trim()) errors.push(`Caption block ${expectedIndex} contains an empty text line`);
    });
  });

  if (Number.isFinite(runtimeSeconds) && previousEnd > (runtimeSeconds * 1000) + 50) {
    errors.push(`Captions end at ${(previousEnd / 1000).toFixed(3)}s after the ${runtimeSeconds}s video`);
  }
  return errors;
}

const buildValues = (release, evidence) => {
  const preview = release._previewOnly === true;
  const headlineRow = evidence.metricRows.find((row) => row.key === release.humanEvidence.headlineMetric);
  const devpostLine = release.artifacts.devpostUrl
    ? `- Devpost: ${release.artifacts.devpostUrl}`
    : '';
  return {
    PREVIEW_NOTICE: preview ? '> PREVIEW ONLY — fictional formatting fixture. Never publish.' : '',
    TITLE_PREFIX: preview ? '[PREVIEW ONLY] ' : '',
    RUN_LEAD: preview ? 'This fictional formatting fixture models' : 'The same player tested',
    CAPTION_CONTEXT: preview ? 'Fictional preview:' : 'In this run:',
    VIDEO_CAPTION_OPENING: preview
      ? "Fictional preview:\nMCPilot turns a player's short course"
      : "MCPilot turns a player's twenty-second\nsignal course into device-local",
    PROJECT_NAME: release.project.name.trim(),
    TAGLINE: release.project.tagline.trim(),
    LIVE_URL: release.artifacts.liveUrl.trim(),
    REPOSITORY_URL: release.artifacts.repositoryUrl.trim().replace(/\/$/, ''),
    RELEASE_TAG: release.artifacts.releaseTag.trim(),
    APPLICATION_COMMIT: release.artifacts.applicationCommit.trim(),
    VIDEO_URL: release.artifacts.videoUrl.trim(),
    VIDEO_RUNTIME: String(release.artifacts.videoRuntimeSeconds),
    SITES_VERSION: String(release.artifacts.sitesVersion),
    DEVPOST_LINE: devpostLine,
    BASELINE_TRIAL_ID: release.humanEvidence.baselineTrialId.trim(),
    ADAPTED_TRIAL_ID: release.humanEvidence.adaptedTrialId.trim(),
    PLAYER_CHECK_IN: checkInLabel(evidence.playerCheckIn),
    SELECTED_NEED: release.humanEvidence.selectedNeed.trim(),
    CHALLENGE_PRESERVED: release.humanEvidence.challengePreserved.trim(),
    INTERACTION_PATH: release.humanEvidence.interactionPathTested.trim(),
    HEADLINE_SENTENCE: evidence.headlineSentence,
    CAPTION_HEADLINE: compactMetricHeadline(headlineRow),
    METRIC_TABLE: formatMetricTable(evidence.metricRows),
    VERDICT_LABEL: evidence.verdictLabel,
    VERDICT_SENTENCE: evidence.verdictSentence,
    PLAYER_OBSERVATION: evidence.playerObservation,
    AUDIO_STATUS: audioStatusLabel(release.humanEvidence.audioEvidence.status),
    AUDIO_OBSERVATION: evidence.audioObservation,
    PRODUCT_TEST_COUNT: String(release.buildEvidence.productTestCount),
  };
};

export function renderSubmissionFiles(release, { templateRoot = templateDirectory } = {}) {
  const validation = validatePackRelease(release, { allowPreview: release?._previewOnly === true });
  if (validation.errors.length) return { errors: validation.errors, files: new Map() };

  const values = buildValues(release, validation.evidence);
  const files = new Map();
  const errors = [];

  for (const [templateName, outputName] of Object.entries(READY_FILES)) {
    let template;
    try {
      template = readFileSync(resolve(templateRoot, templateName), 'utf8');
    } catch (error) {
      errors.push(`Could not read ${templateName}: ${error.message}`);
      continue;
    }
    const rendered = renderTemplate(template, values, templateName);
    if (rendered.error) errors.push(rendered.error);
    else files.set(outputName, rendered.output);
  }

  const title = files.get('YOUTUBE_TITLE.txt');
  if (title && [...title.trim()].length > 100) errors.push('YouTube title exceeds 100 characters');
  const description = files.get('YOUTUBE_DESCRIPTION.txt');
  if (description && [...description].length > 5_000) errors.push('YouTube description exceeds 5,000 characters');
  const captions = files.get('DEMO_CAPTIONS.srt');
  if (captions) errors.push(...validateSrt(captions, release.artifacts.videoRuntimeSeconds));

  return { errors, files, evidence: validation.evidence, values };
}
