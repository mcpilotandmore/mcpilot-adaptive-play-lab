import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { compareApplicationPackages } from './application-release.mjs';
import { isReleaseManifestObject, validatePackRelease } from './submission-data.mjs';
import { renderSubmissionFiles } from './submission-render.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const errors = [];
const warnings = [];

const requiredFiles = [
  '.openai/hosting.json',
  'LICENSE',
  'README.md',
  'app/core.mjs',
  'app/hazard-presentation.mjs',
  'app/lab-lifecycle.mjs',
  'app/layout.tsx',
  'app/page.tsx',
  'app/persistence.mjs',
  'app/webmcp-contract.mjs',
  'package-lock.json',
  'package.json',
  'public/og.png',
  'public/signal-run-arena-v1.webp',
  'public/hazards/manifest.json',
  'public/hazards/pulse-mine.webp',
  'public/hazards/rift-spire.webp',
  'public/hazards/static-thorn.webp',
  'scripts/check-release.mjs',
  'scripts/application-release.mjs',
  'scripts/check-media.mjs',
  'scripts/check-media-tools.mjs',
  'scripts/check-submission.mjs',
  'scripts/compose-media-images.mjs',
  'scripts/generate-hazard-assets.mjs',
  'scripts/pack-submission.mjs',
  'scripts/render-video-kit.mjs',
  'scripts/submission-data.mjs',
  'scripts/submission-render.mjs',
  'scripts/verify-clean-checkout.mjs',
  'submission.release.json',
  'submission.capture.json',
  'submission.media.json',
  'submission/templates/DEMO_CAPTIONS.srt.tmpl',
  'submission/templates/DEVPOST.md.tmpl',
  'submission/templates/GALLERY_COPY.md.tmpl',
  'submission/templates/README_RELEASE_BLOCK.md.tmpl',
  'submission/templates/YOUTUBE_DESCRIPTION.txt.tmpl',
  'submission/templates/YOUTUBE_TITLE.txt.tmpl',
  'tests/core.test.mjs',
  'tests/application-release.test.mjs',
  'tests/lab-lifecycle.test.mjs',
  'tests/media-gate.test.mjs',
  'tests/media-images.test.mjs',
  'tests/media-tools.test.mjs',
  'tests/persistence.test.mjs',
  'tests/submission-pack.test.mjs',
  'tests/video-kit.test.mjs',
  'tests/webmcp-contract.test.mjs',
  'docs/CLAIM_MATRIX.md',
  'docs/COLD_JUDGE_REVIEW.md',
  'docs/DEMO_CAPTIONS.srt',
  'docs/DEMO_SCRIPT.md',
  'docs/DEVPOST_SUBMISSION.md',
  'docs/PUBLICATION_COPY.md',
  'docs/TESTER_RUNBOOK.md',
  'docs/VIDEO_PRODUCTION.md',
];

const runGit = (args, timeout = 10_000) => spawnSync('git', args, {
  cwd: root,
  encoding: 'utf8',
  timeout,
});

const readGitJson = (ref, path) => {
  const result = runGit(['show', `${ref}:${path}`]);
  if (result.status !== 0) throw new Error(`Could not read ${path} at ${ref}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${path} at ${ref} is invalid JSON: ${error.message}`);
  }
};

for (const path of requiredFiles) {
  if (!existsSync(resolve(root, path))) errors.push(`Missing required file: ${path}`);
}

let release;
try {
  release = JSON.parse(readFileSync(resolve(root, 'submission.release.json'), 'utf8'));
} catch (error) {
  errors.push(`submission.release.json is invalid: ${error.message}`);
}
if (release !== undefined && !isReleaseManifestObject(release)) {
  errors.push('submission.release.json must contain one non-null JSON object');
  release = undefined;
}

const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isResolvedText = (value) => isText(value)
  && !/\[[^\]]+\]|\{[^}]+\}|\b(?:TBD|TODO|PENDING)\b/i.test(value)
  && !/^(?:unknown|null|n\/a|none)$/i.test(value.trim());
const requireText = (value, label) => {
  if (!isResolvedText(value)) errors.push(`Release manifest needs ${label}`);
};
const requireTrue = (value, label) => {
  if (value !== true) errors.push(`Release verification incomplete: ${label}`);
};

const parseHttpsUrl = (value, label, allowedHosts) => {
  if (!isResolvedText(value)) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') errors.push(`${label} must use HTTPS`);
    if (url.username || url.password) errors.push(`${label} must not contain credentials`);
    if (allowedHosts && !allowedHosts.includes(url.hostname.toLowerCase())) {
      errors.push(`${label} must use ${allowedHosts.join(', ')}`);
    }
    return url;
  } catch {
    errors.push(`${label} is not a valid URL`);
    return null;
  }
};

const repositoryIdentityFromUrl = (url, label) => {
  if (!url) return null;
  if (url.search || url.hash) errors.push(`${label} must be a canonical repository root URL without query or fragment`);
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.at(-1)?.endsWith('.git')) {
    errors.push(`${label} must be a browser URL without the .git suffix`);
    segments[segments.length - 1] = segments.at(-1).slice(0, -4);
  }
  const host = url.hostname.toLowerCase();
  const invalidShape = segments.length < 2
    || ((host === 'github.com' || host === 'bitbucket.org') && segments.length !== 2)
    || (host === 'gitlab.com' && segments.includes('-'));
  if (invalidShape) errors.push(`${label} must point to a repository root, not a host homepage or subpage`);
  return segments.length >= 2 ? `${host}/${segments.join('/')}`.toLowerCase() : null;
};

const repositoryIdentityFromRemote = (rawValue) => {
  const raw = rawValue.trim();
  if (!raw) return null;
  let host;
  let path;
  if (!raw.includes('://')) {
    const scp = raw.match(/^(?:[^@]+@)?([^:]+):(.+)$/);
    if (!scp) return null;
    [, host, path] = scp;
  } else {
    try {
      const url = new URL(raw);
      host = url.hostname;
      path = url.pathname;
    } catch {
      return null;
    }
  }
  const normalizedPath = path.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
  return host && normalizedPath ? `${host}/${normalizedPath}`.toLowerCase() : null;
};

const isYouTubeVideoUrl = (url) => {
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') return segments.length === 1 && segments[0].length >= 6;
  if ((host === 'youtube.com' || host === 'www.youtube.com')
      && url.pathname === '/watch' && (url.searchParams.get('v')?.length ?? 0) >= 6) return true;
  return (host === 'youtube.com' || host === 'www.youtube.com')
    && ['shorts', 'live', 'embed'].includes(segments[0])
    && (segments[1]?.length ?? 0) >= 6;
};

const isPrivateIpv4 = (address) => {
  const [a, b, c] = address.split('.').map(Number);
  return a === 0
    || a === 10
    || a === 127
    || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113);
};

const isNonPublicHostname = (rawHostname) => {
  const hostname = rawHostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')
      || hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) return isPrivateIpv4(hostname);
  if (ipVersion === 6) {
    if (hostname.startsWith('::ffff:')) {
      const mapped = hostname.slice('::ffff:'.length);
      return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
    }
    return hostname === '::' || hostname === '::1'
      || hostname.startsWith('fc') || hostname.startsWith('fd')
      || /^fe[89ab]/.test(hostname) || hostname.startsWith('ff')
      || hostname.startsWith('2001:db8:');
  }
  return !hostname.includes('.');
};

let liveUrl;
let repositoryUrl;
let repositoryIdentity;
let videoUrl;
let renderedPacket;

if (release) {
  const packValidation = validatePackRelease(release);
  errors.push(...packValidation.errors.map((error) => `Release manifest: ${error}`));
  if (!packValidation.errors.length) {
    renderedPacket = renderSubmissionFiles(release);
    errors.push(...renderedPacket.errors.map((error) => `Release packet: ${error}`));
  }

  liveUrl = parseHttpsUrl(release.artifacts?.liveUrl, 'a judge-accessible live URL');
  if (liveUrl && isNonPublicHostname(liveUrl.hostname)) {
    errors.push('Judge-accessible live URL must use a public hostname or IP address');
  }
  repositoryUrl = parseHttpsUrl(
    release.artifacts?.repositoryUrl,
    'a public repository URL',
    ['github.com', 'gitlab.com', 'bitbucket.org'],
  );
  repositoryIdentity = repositoryIdentityFromUrl(repositoryUrl, 'Public repository URL');
  videoUrl = parseHttpsUrl(
    release.artifacts?.videoUrl,
    'a public YouTube video URL',
    ['youtube.com', 'www.youtube.com', 'youtu.be'],
  );
  if (videoUrl && !isYouTubeVideoUrl(videoUrl)) {
    errors.push('Public YouTube URL must point to a specific video');
  }
  if (!/^[0-9a-f]{40}$/i.test(release.artifacts?.applicationCommit ?? '')) {
    errors.push('applicationCommit must be a 40-character Git commit');
  }

  const runtime = release.artifacts?.videoRuntimeSeconds;
  if (Number.isFinite(runtime) && (runtime < 118 || runtime > 125)) {
    warnings.push('Video passes the rule but falls outside the rehearsed 1:58–2:05 target');
  }
  const playerCheckIn = typeof release.humanEvidence?.playerCheckIn === 'string'
    ? release.humanEvidence.playerCheckIn.trim().toLowerCase()
    : release.humanEvidence?.playerCheckIn;
  if (['same', 'worse', 'skipped'].includes(playerCheckIn)) {
    warnings.push('The final run is valid but public copy must not describe it as a clear improvement');
  }

  const verificationLabels = {
    devpostRegistrationComplete: 'entrant is registered for the challenge on Devpost',
    entrantEligibilityConfirmed: 'entrant confirms official age, location, and authority eligibility without storing identity details',
    liveSignedOutInChatgpt: 'live app opens signed out in ChatGPT',
    liveSignedOutInChrome: 'live app opens signed out in Chrome',
    chromeWebMcpLifecyclePassed: 'complete WebMCP lifecycle passes in enabled Chrome',
    repositorySignedOut: 'repository opens signed out',
    repositorySetupVerifiedFromCleanCheckout: 'repository setup works from a clean checkout',
    licenseVisibleAtRepositoryTop: 'open-source license is visible at the top of the repository page',
    videoSignedOut: 'video opens signed out',
    videoAudioCoversBuildAndWebMcp: 'video audio explains the build and WebMCP use',
    videoMediaRightsCleared: 'video trademarks, music, media, and participant rights are cleared',
    videoCaptionsChecked: 'video captions are hand-checked',
    approvalTransitionContinuousInVideo: 'approval-to-tool transition is continuous in the final video',
    samePlayerTrialsVisibleInVideo: 'same-player trials are visible in the final video',
    publicResultMatchesEvidence: 'public result matches the recorded evidence',
    coldJudgeReviewPassed: 'cold-judge review passes',
    noPersonalInformation: 'final artifacts contain no personal information',
    publicAccessCommittedThroughJudging: 'app remains free and available through the judging period',
  };
  for (const [field, label] of Object.entries(verificationLabels)) {
    requireTrue(release.verification?.[field], label);
  }

  requireTrue(release.freeze?.finalNameReconciled, 'final name is reconciled everywhere');
  requireTrue(release.freeze?.claimsReconciled, 'claims are reconciled everywhere');
  requireTrue(release.freeze?.publicArtifactsFrozen, 'public artifacts are frozen');
  requireText(release.freeze?.frozenAt, 'an ISO freeze timestamp');
  if (isResolvedText(release.freeze?.frozenAt)) {
    const frozenAt = release.freeze.frozenAt;
    const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
    const parsed = Date.parse(frozenAt);
    const normalized = Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
    const canonical = frozenAt.includes('.') ? normalized : normalized?.replace(/\.000Z$/, 'Z');
    if (!timestampPattern.test(frozenAt) || canonical !== frozenAt) {
      errors.push('frozenAt must be a valid canonical ISO 8601 UTC timestamp');
    }
  }
}

if (renderedPacket && !renderedPacket.errors.length) {
  const readyRoot = resolve(root, 'submission', 'ready');
  if (existsSync(readyRoot)) {
    const entries = readdirSync(readyRoot, { withFileTypes: true });
    const expected = new Set(renderedPacket.files.keys());
    const unexpected = entries.filter((entry) => !entry.isFile() || !expected.has(entry.name));
    if (unexpected.length) {
      errors.push(`Final release packet contains unexpected entries: ${unexpected.map((entry) => entry.name).join(', ')}`);
    }
  }
  for (const [name, expected] of renderedPacket.files) {
    const relativePath = `submission/ready/${name}`;
    requiredFiles.push(relativePath);
    const absolutePath = resolve(readyRoot, name);
    if (!existsSync(absolutePath)) {
      errors.push(`Final release packet is missing ${relativePath}; run npm run submission:pack`);
      continue;
    }
    const actual = readFileSync(absolutePath, 'utf8').replace(/\r\n?/g, '\n');
    if (actual !== expected) {
      errors.push(`${relativePath} is stale or differs from submission.release.json`);
    }
  }
  const mediaGate = spawnSync(process.execPath, ['scripts/check-media.mjs', '--strict'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 180_000,
  });
  if (mediaGate.status !== 0) {
    errors.push('Final media acceptance gate failed; run npm run submission:media-check for details');
  }
}

if (existsSync(resolve(root, 'README.md'))) {
  const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
  if (!/^## License\s+[\s\S]*?\[MIT\]\(LICENSE\)/m.test(readme)) {
    errors.push('README must link its License section to the top-level LICENSE file');
  }
  if (/owner-only/i.test(readme) || /not yet publicly accessible/i.test(readme)) {
    errors.push('README still describes the canonical artifact as private');
  }
  if (/working title/i.test(readme)) errors.push('README still uses a working title');
}

const literalChecks = [
  [release?.project?.name, 'final project name', [
    'README.md',
    'app/layout.tsx',
    'app/page.tsx',
    'submission/ready/DEVPOST.md',
    'submission/ready/GALLERY_COPY.md',
    'submission/ready/README_RELEASE_BLOCK.md',
    'submission/ready/YOUTUBE_DESCRIPTION.txt',
    'submission/ready/YOUTUBE_TITLE.txt',
  ]],
  [release?.artifacts?.liveUrl, 'live URL', [
    'README.md',
    'submission/ready/DEVPOST.md',
    'submission/ready/README_RELEASE_BLOCK.md',
    'submission/ready/YOUTUBE_DESCRIPTION.txt',
  ]],
  [release?.artifacts?.repositoryUrl, 'repository URL', [
    'README.md',
    'submission/ready/DEVPOST.md',
    'submission/ready/README_RELEASE_BLOCK.md',
    'submission/ready/YOUTUBE_DESCRIPTION.txt',
  ]],
  [release?.artifacts?.videoUrl, 'video URL', [
    'README.md',
    'submission/ready/DEVPOST.md',
    'submission/ready/README_RELEASE_BLOCK.md',
  ]],
  [release?.artifacts?.releaseTag, 'release tag', [
    'README.md',
    'submission/ready/DEVPOST.md',
    'submission/ready/README_RELEASE_BLOCK.md',
    'submission/ready/YOUTUBE_DESCRIPTION.txt',
  ]],
];
for (const [value, label, paths] of literalChecks) {
  if (!isResolvedText(value)) continue;
  for (const path of paths) {
    const absolutePath = resolve(root, path);
    if (existsSync(absolutePath) && !readFileSync(absolutePath, 'utf8').includes(value)) {
      errors.push(`${path} does not contain the manifest ${label}`);
    }
  }
}

const worktreeResult = runGit(['status', '--porcelain=v1', '--untracked-files=all']);
if (worktreeResult.status !== 0) {
  errors.push('Could not inspect Git worktree status');
} else if (worktreeResult.stdout.trim()) {
  errors.push('Git worktree must be clean before the submission can be certified');
}

let matchingRemote;
let matchingPushUrl;
const remoteNamesResult = runGit(['remote']);
const remoteNames = remoteNamesResult.status === 0
  ? remoteNamesResult.stdout.split(/\r?\n/).map((name) => name.trim()).filter(Boolean)
  : [];
if (!remoteNames.length) {
  errors.push('Git has no public repository remote');
} else if (repositoryIdentity) {
  for (const name of remoteNames) {
    const pushUrlResult = runGit(['remote', 'get-url', '--push', name]);
    if (pushUrlResult.status === 0
        && repositoryIdentityFromRemote(pushUrlResult.stdout) === repositoryIdentity) {
      matchingRemote = name;
      matchingPushUrl = pushUrlResult.stdout.trim();
      break;
    }
  }
  if (!matchingRemote) errors.push('No Git push remote matches the manifest public repository URL');
}

let tagRef;
let tagCommit;
if (isResolvedText(release?.artifacts?.releaseTag)) {
  tagRef = `refs/tags/${release.artifacts.releaseTag}`;
  const refResult = runGit(['check-ref-format', tagRef]);
  if (refResult.status !== 0) {
    errors.push(`Git release tag is not a valid literal ref: ${release.artifacts.releaseTag}`);
  } else {
    const tagResult = runGit(['rev-parse', '-q', '--verify', `${tagRef}^{commit}`]);
    if (tagResult.status !== 0) {
      errors.push(`Git release tag does not exist: ${release.artifacts.releaseTag}`);
    } else {
      tagCommit = tagResult.stdout.trim();
      const headResult = runGit(['rev-parse', 'HEAD']);
      if (headResult.status !== 0 || tagCommit !== headResult.stdout.trim()) {
        errors.push(`Git release tag ${release.artifacts.releaseTag} does not point to HEAD`);
      }
      const missingInTag = requiredFiles.filter((path) => (
        runGit(['cat-file', '-e', `${tagRef}:${path}`]).status !== 0
      ));
      if (missingInTag.length) {
        errors.push(`Release tag is missing required files: ${missingInTag.slice(0, 5).join(', ')}${missingInTag.length > 5 ? ', …' : ''}`);
      }
    }
  }
}

if (matchingRemote && matchingPushUrl && tagRef && tagCommit) {
  const remoteTagResult = runGit(['ls-remote', '--tags', matchingPushUrl, tagRef, `${tagRef}^{}`], 20_000);
  if (remoteTagResult.status !== 0) {
    errors.push(`Could not verify release tag on remote ${matchingRemote}`);
  } else {
    const remoteRefs = new Map(remoteTagResult.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => {
      const [hash, ref] = line.split(/\s+/);
      return [ref, hash];
    }));
    const remoteCommit = remoteRefs.get(`${tagRef}^{}`) ?? remoteRefs.get(tagRef);
    if (!remoteCommit) errors.push(`Release tag ${release.artifacts.releaseTag} has not been pushed to ${matchingRemote}`);
    else if (remoteCommit !== tagCommit) errors.push(`Remote release tag ${release.artifacts.releaseTag} does not match local HEAD`);
  }
}

if (/^[0-9a-f]{40}$/i.test(release?.artifacts?.applicationCommit ?? '')) {
  const applicationCommit = release.artifacts.applicationCommit;
  const commitResult = runGit(['cat-file', '-t', applicationCommit]);
  if (commitResult.status !== 0) {
    errors.push(`applicationCommit is not available in this repository: ${applicationCommit}`);
  } else if (commitResult.stdout.trim() !== 'commit') {
    errors.push(`applicationCommit must identify a commit object, not ${commitResult.stdout.trim()}`);
  } else if (tagCommit && runGit(['merge-base', '--is-ancestor', applicationCommit, tagCommit]).status !== 0) {
    errors.push('applicationCommit is not an ancestor of the frozen release tag');
  } else if (tagCommit) {
    if (runGit([
      'diff',
      '--quiet',
      applicationCommit,
      tagCommit,
      '--',
      '.openai/hosting.json',
      'app',
      'public',
      'next.config.ts',
      'tsconfig.json',
      'vite.config.ts',
    ]).status !== 0) {
      errors.push('Application files changed after applicationCommit; record the exact deployed source commit');
    }
    try {
      errors.push(...compareApplicationPackages(
        readGitJson(applicationCommit, 'package.json'),
        readGitJson(tagCommit, 'package.json'),
        readGitJson(applicationCommit, 'package-lock.json'),
        readGitJson(tagCommit, 'package-lock.json'),
      ));
    } catch (error) {
      errors.push(`Could not verify application dependency identity: ${error.message}`);
    }
  }
}

const uniqueErrors = [...new Set(errors)];
const uniqueWarnings = [...new Set(warnings)];
const state = uniqueErrors.length ? 'BLOCKED' : 'READY';
console.log(`Submission readiness: ${state}`);
console.log(`Blocking items: ${uniqueErrors.length}`);
for (const error of uniqueErrors) console.log(`  - ${error}`);
console.log(`Warnings: ${uniqueWarnings.length}`);
for (const warning of uniqueWarnings) console.log(`  - ${warning}`);
console.log('Source of truth: submission.release.json');
console.log(strict ? 'Mode: strict' : 'Mode: status-only');

if (strict && uniqueErrors.length) process.exitCode = 1;
