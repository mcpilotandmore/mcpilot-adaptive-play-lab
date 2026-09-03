import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { isResolvedText, makePreviewRelease } from './submission-data.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = dirname(scriptPath);
const root = resolve(scriptDirectory, '..');

const palette = Object.freeze({
  ink: '#05070D',
  paper: '#F7F9FF',
  mint: '#68F2BA',
  periwinkle: '#7589FF',
  muted: '#A8B0C4',
});

export const OVERLAYS = Object.freeze([
  {
    file: 'sp_01_run_shortened_1920x1080.svg',
    start: '00:04.20',
    end: '00:07.50',
    placement: 'lower-left',
    purpose: 'Disclose the baseline jump cut without interrupting the opening human-play evidence.',
  },
  {
    file: 'sp_02_baseline_human_played_1920x1080.svg',
    start: '00:00.20',
    end: '00:03.80',
    placement: 'upper-left',
    purpose: 'Attribute the baseline to the human without covering the arena.',
  },
  {
    file: 'sp_03_proposing_not_applying_1920x1080.svg',
    start: '00:30.20',
    end: '00:36.50',
    placement: 'lower-left',
    purpose: 'Separate agent advice from authority before the permission climax.',
  },
  {
    file: 'sp_04_adapted_human_played_1920x1080.svg',
    start: '00:54.20',
    end: '00:58.00',
    placement: 'upper-left',
    purpose: 'Attribute the adapted trial to the same human on the same course.',
  },
  {
    file: 'sp_05_end_approval_capability_1920x1080.svg',
    start: '01:57.00',
    end: '01:58.85',
    placement: 'left lockup',
    purpose: 'Land the name and player-control thesis over the real post-undo state.',
  },
]);

export const SHOTS = Object.freeze([
  { start: 0, end: 8, title: 'HUMAN-PLAYED BASELINE', body: 'Start inside the real baseline. Shorten the 20-second course with an explicit jump-cut label.', state: '06 · APPLY ABSENT', caption: 'Source-labeled evidence—not a diagnosis.' },
  { start: 8, end: 12, title: 'REQUEST READY', body: 'The exact request is already pasted. Show only the Send click.', state: '06 · APPLY ABSENT', caption: 'The request is already pasted.' },
  { start: 12, end: 30, title: 'THREE REAL WEBMCP CALLS', body: 'Show inspect, signal read, and proposal calls in the actual agent pane. Cut only latency.', state: '06 · APPLY ABSENT', caption: 'The browser agent calls three real tools.' },
  { start: 30, end: 44, title: 'PLAYER APPROVAL CREATES TOOL 7', body: 'Show exact rows and Apply absent, then keep the human click through registration continuous.', state: '06 → 07 · APPLY ADDED', caption: 'Only the player can create tool seven.' },
  { start: 44, end: 54, title: 'EXACT APPLY · EXACT UNDO', body: 'Run only the approved revision. Apply disappears and exact undo replaces it.', state: '07 · APPLY REMOVED / UNDO ADDED', caption: 'Apply disappears. Exact undo takes its place.' },
  { start: 54, end: 64, title: 'SAME PLAYER · SAME COURSE', body: 'Shorten the adapted run with the same explicit treatment. The agent never plays.', state: '07 · COMPARE ABSENT', caption: 'The agent never plays.' },
  { start: 64, end: 74, title: 'THE PLAYER CHECK-IN', body: 'Show Compare absent, then keep the uncoached response through registration continuous.', state: '07 → 08 · COMPARE ADDED', caption: 'Only the player can unlock comparison.' },
  { start: 74, end: 96, title: 'EVIDENCE BEFORE VERDICT', body: 'Show the real comparison call, all available deltas, regressions, player response, and verdict.', state: '08 · COMPARE ADDED', caption: 'Report only the verdict the evidence supports.' },
  { start: 96, end: 107, title: 'REVERSAL WITHOUT ERASURE', body: 'Call exact undo, restore all prior values, remove Undo, and retain completed evidence.', state: 'UNDO · EVIDENCE RETAINED', caption: 'Undo restores settings without deleting evidence.' },
  { start: 107, end: 117, title: 'IMPERATIVE REGISTRATION', body: 'Hold the real capability surface while explaining deterministic bounds, provenance, verdicts, and undo.', state: 'PLAYER CONTROL · REAL TOOLS', caption: 'The agent gets no approval or check-in tool.' },
  { start: 117, end: 119, title: 'NAME · REAL INTERFACE', body: 'Land the final name and tagline over the unobstructed post-undo interface.', state: 'PLAYER CONTROL · REAL TOOLS', caption: 'Your approval changes what the agent can do.' },
]);

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const fontCss = () => {
  const fonts = [
    ['Geist', resolve(root, 'node_modules', 'next', 'dist', 'esm', 'next-devtools', 'server', 'font', 'geist-latin.woff2')],
    ['Geist Mono', resolve(root, 'node_modules', 'next', 'dist', 'esm', 'next-devtools', 'server', 'font', 'geist-mono-latin.woff2')],
  ];
  return fonts.filter(([, path]) => existsSync(path)).map(([name, path]) => (
    `@font-face{font-family:'${name}';src:url(data:font/woff2;base64,${readFileSync(path).toString('base64')}) format('woff2');}`
  )).join('');
};

const svgShell = (body, { opaque = false } = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${palette.mint}"/><stop offset="1" stop-color="${palette.periwinkle}"/></linearGradient>
    <radialGradient id="halo" cx="70%" cy="30%" r="75%"><stop stop-color="${palette.periwinkle}" stop-opacity=".22"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></radialGradient>
    <filter id="shadow" x="-20%" y="-30%" width="150%" height="180%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity=".48"/></filter>
    <style>${fontCss()}
      .sans{font-family:'Geist','Segoe UI',Arial,sans-serif}.mono{font-family:'Geist Mono','Cascadia Mono',monospace}
      .label{font-size:22px;font-weight:650;letter-spacing:4px}.title{font-size:54px;font-weight:720;letter-spacing:-1.5px}.sub{font-size:25px;font-weight:480}.micro{font-size:18px;font-weight:560;letter-spacing:2px}
    </style>
  </defs>
  ${opaque ? `<rect width="1920" height="1080" fill="${palette.ink}"/><rect width="1920" height="1080" fill="url(#halo)"/>` : ''}
  ${body}
</svg>
`;

const capabilityTicks = (x, y, active = false) => Array.from({ length: 7 }, (_, index) => {
  const fill = index === 6 ? (active ? palette.mint : 'none') : palette.periwinkle;
  const stroke = index === 6 ? palette.mint : palette.periwinkle;
  return `<rect x="${x + (index * 35)}" y="${y}" width="23" height="8" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2" opacity="${index === 6 && !active ? '.75' : '1'}"/>`;
}).join('');

export function buildOverlaySvgs(projectName) {
  const nameLines = wrapProjectName(projectName);
  const nameSize = nameLines.length === 1
    ? (projectName.length <= 24 ? 78 : 66)
    : 46;
  const nameStartY = nameLines.length === 1 ? 402 : 372;
  const files = new Map();

  files.set(OVERLAYS[0].file, svgShell(`
  <g filter="url(#shadow)">
    <rect x="192" y="612" width="804" height="152" rx="26" fill="${palette.ink}" fill-opacity=".94" stroke="#FFFFFF" stroke-opacity=".12"/>
    <rect x="192" y="612" width="8" height="152" rx="4" fill="url(#edge)"/>
    <text x="242" y="675" class="sans" font-size="43" font-weight="720" fill="${palette.paper}">20-SECOND RUN · SHORTENED</text>
    <text x="242" y="724" class="sans sub" fill="${palette.muted}">Jump cut shown honestly. Human play remains visible.</text>
  </g>`));

  files.set(OVERLAYS[1].file, svgShell(`
  <g filter="url(#shadow)">
    <rect x="192" y="120" width="560" height="84" rx="22" fill="${palette.ink}" fill-opacity=".94" stroke="#FFFFFF" stroke-opacity=".12"/>
    <circle cx="234" cy="162" r="9" fill="${palette.periwinkle}"/>
    <text x="262" y="171" class="mono" font-size="21" font-weight="650" letter-spacing="2.4" fill="${palette.paper}">BASELINE · HUMAN-PLAYED</text>
  </g>`));

  files.set(OVERLAYS[2].file, svgShell(`
  <g filter="url(#shadow)">
    <rect x="192" y="612" width="972" height="152" rx="26" fill="${palette.ink}" fill-opacity=".94" stroke="#FFFFFF" stroke-opacity=".12"/>
    <rect x="192" y="612" width="8" height="152" rx="4" fill="${palette.periwinkle}"/>
    <text x="242" y="675" class="sans title" fill="${palette.paper}">PROPOSING IS NOT APPLYING.</text>
    <text x="242" y="724" class="sans sub" fill="${palette.muted}">No setting changed. Apply is still absent.</text>
  </g>`));

  files.set(OVERLAYS[3].file, svgShell(`
  <g filter="url(#shadow)">
    <rect x="192" y="120" width="560" height="84" rx="22" fill="${palette.ink}" fill-opacity=".94" stroke="#FFFFFF" stroke-opacity=".12"/>
    <circle cx="234" cy="162" r="9" fill="${palette.mint}"/>
    <text x="262" y="171" class="mono" font-size="19" font-weight="650" letter-spacing="2.1" fill="${palette.paper}">ADAPTED · HUMAN-PLAYED · SHORTENED</text>
  </g>`));

  files.set(OVERLAYS[4].file, svgShell(`
  <g filter="url(#shadow)">
    <rect x="192" y="174" width="1048" height="470" rx="32" fill="${palette.ink}" fill-opacity=".94" stroke="#FFFFFF" stroke-opacity=".12"/>
    <path d="M242 224H650" stroke="url(#edge)" stroke-width="8" stroke-linecap="round"/>
    <text x="242" y="292" class="mono label" fill="${palette.mint}">A HUMAN-AGENT GAME LOOP</text>
    <text x="242" y="${nameStartY}" class="sans" font-size="${nameSize}" font-weight="740" letter-spacing="-3" fill="${palette.paper}">
      ${nameLines.map((line, lineIndex) => {
    const fit = line.length > 15 ? ' textLength="900" lengthAdjust="spacingAndGlyphs"' : '';
    return `<tspan x="242" dy="${lineIndex === 0 ? 0 : 56}"${fit}>${escapeXml(line)}</tspan>`;
  }).join('')}
    </text>
    <text x="242" y="500" class="sans" font-size="35" font-weight="520" fill="${palette.paper}">Your approval changes what the agent can do.</text>
    <text x="242" y="554" class="sans sub" fill="${palette.muted}">Evidence · review · proof · reversal</text>
    ${capabilityTicks(242, 590, true)}
    <text x="520" y="603" class="mono micro" fill="${palette.muted}">06 APPLY ABSENT  →  07 APPLY ADDED</text>
  </g>`));

  return files;
}

const padTime = (seconds) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
};

export const wrapWords = (value, max = 58) => {
  const lines = [];
  for (const word of value.split(/\s+/)) {
    const candidate = lines.length ? `${lines.at(-1)} ${word}` : word;
    if (!lines.length || candidate.length > max) lines.push(word);
    else lines[lines.length - 1] = candidate;
  }
  return lines;
};

const wrapProjectName = (value) => {
  if (value.length <= 28) return [value];
  const words = value.trim().split(/\s+/);
  if (words.length === 1) {
    const midpoint = Math.ceil(value.length / 2);
    return [value.slice(0, midpoint), value.slice(midpoint)];
  }
  let best = 1;
  let smallestImbalance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const first = words.slice(0, index).join(' ');
    const second = words.slice(index).join(' ');
    const imbalance = Math.abs(first.length - second.length);
    if (imbalance < smallestImbalance) {
      best = index;
      smallestImbalance = imbalance;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
};

export function buildSlateSvgs() {
  return SHOTS.map((shot, index) => {
    const bodyLines = wrapWords(shot.body, 30);
    return svgShell(`
  <g>
    <rect x="34" y="34" width="1244" height="1012" rx="28" fill="#080C14" stroke="#FFFFFF" stroke-opacity=".10"/>
    <rect x="1306" y="34" width="580" height="1012" rx="28" fill="#0C1120" stroke="#FFFFFF" stroke-opacity=".12"/>
    <rect x="1306" y="34" width="6" height="1012" fill="url(#edge)"/>

    <text x="76" y="91" class="mono micro" fill="${palette.muted}">REPRESENTATIVE APP FRAME · 68%</text>
    <text x="76" y="144" class="sans" font-size="34" font-weight="720" fill="${palette.paper}">${escapeXml(shot.title)}</text>
    <rect x="76" y="180" width="760" height="610" rx="24" fill="#0D1421" stroke="${palette.periwinkle}" stroke-opacity=".30"/>
    <path d="M132 686C300 570 390 640 522 472S740 350 788 270" fill="none" stroke="${palette.periwinkle}" stroke-opacity=".42" stroke-width="10" stroke-linecap="round"/>
    <circle cx="276" cy="550" r="42" fill="none" stroke="${palette.mint}" stroke-width="8"/>
    <circle cx="558" cy="438" r="34" fill="${palette.periwinkle}" fill-opacity=".55"/>
    <path d="M694 282l34 58h-68z" fill="${palette.mint}" fill-opacity=".72"/>
    <rect x="112" y="730" width="682" height="8" rx="4" fill="#FFFFFF" fill-opacity=".10"/>

    <rect x="860" y="180" width="376" height="610" rx="24" fill="#0D1421" stroke="#FFFFFF" stroke-opacity=".10"/>
    <text x="898" y="240" class="mono micro" fill="${palette.mint}">CAPABILITY STATE</text>
    <text x="898" y="294" class="mono" font-size="21" font-weight="650" fill="${palette.paper}">${escapeXml(shot.state)}</text>
    <rect x="898" y="338" width="298" height="1" fill="#FFFFFF" fill-opacity=".12"/>
    <text x="898" y="394" class="mono micro" fill="${palette.muted}">EDITOR NOTE</text>
    <text x="898" y="444" class="sans" font-size="23" fill="${palette.paper}">
      ${bodyLines.map((line, lineIndex) => `<tspan x="898" dy="${lineIndex === 0 ? 0 : 36}">${escapeXml(line)}</tspan>`).join('')}
    </text>
    ${capabilityTicks(898, 704, shot.state.includes('ADDED'))}

    <text x="1354" y="91" class="mono micro" fill="${palette.muted}">AGENT PANE · 32%</text>
    <text x="1354" y="148" class="sans" font-size="28" font-weight="700" fill="${palette.paper}">Browser agent</text>
    <rect x="1354" y="196" width="484" height="92" rx="18" fill="#111A2B"/>
    <text x="1384" y="235" class="mono" font-size="16" fill="${palette.mint}">TOOL SURFACE</text>
    <text x="1384" y="266" class="mono" font-size="18" fill="${palette.paper}">${escapeXml(shot.state)}</text>
    <rect x="1354" y="314" width="484" height="132" rx="18" fill="#111A2B"/>
    <rect x="1384" y="350" width="248" height="12" rx="6" fill="${palette.periwinkle}" fill-opacity=".55"/>
    <rect x="1384" y="382" width="382" height="10" rx="5" fill="#FFFFFF" fill-opacity=".12"/>
    <rect x="1384" y="408" width="318" height="10" rx="5" fill="#FFFFFF" fill-opacity=".08"/>
    <text x="1354" y="934" class="mono" font-size="16" letter-spacing="2" fill="${palette.periwinkle}">ANIMATIC · REPLACE WITH REAL CAPTURE</text>

    <path d="M192 890H1728" stroke="#FFFFFF" stroke-opacity=".16" stroke-dasharray="8 12"/>
    <text x="960" y="917" text-anchor="middle" class="mono" font-size="15" letter-spacing="2" fill="${palette.muted}">CAPTION-SAFE GUIDE</text>
    <rect x="384" y="944" width="1152" height="78" rx="16" fill="#000000" fill-opacity=".82"/>
    <text x="960" y="994" text-anchor="middle" class="sans" font-size="28" font-weight="580" fill="${palette.paper}">${escapeXml(shot.caption)}</text>
    <text x="1798" y="1016" text-anchor="end" class="mono" font-size="16" fill="${palette.muted}">SHOT ${(index + 1).toString().padStart(2, '0')} · ${padTime(shot.start)}–${padTime(shot.end)}</text>
  </g>`, { opaque: true });
  });
}

export function validateVideoKitDefinition() {
  const errors = [];
  if (OVERLAYS.length !== 5) errors.push('The film must use exactly five editorial overlays');
  const names = new Set(OVERLAYS.map((overlay) => overlay.file));
  if (names.size !== OVERLAYS.length) errors.push('Overlay filenames must be unique');
  if (SHOTS[0]?.start !== 0 || SHOTS.at(-1)?.end !== 119) errors.push('Animatic must span exactly 00:00–01:59');
  SHOTS.forEach((shot, index) => {
    if (shot.end <= shot.start) errors.push(`Shot ${index + 1} has invalid timing`);
    if (index > 0 && shot.start !== SHOTS[index - 1].end) errors.push(`Shot ${index + 1} does not meet the previous shot`);
  });
  const approvalOverlays = OVERLAYS.filter((overlay) => {
    const toSeconds = (value) => {
      const [minutes, seconds] = value.split(':').map(Number);
      return minutes * 60 + seconds;
    };
    return toSeconds(overlay.start) < 44 && toSeconds(overlay.end) > 37;
  });
  if (approvalOverlays.length) errors.push('No editorial overlay may cover the 00:37–00:44 approval climax');
  const endOverlay = OVERLAYS.find((overlay) => overlay.file === 'sp_05_end_approval_capability_1920x1080.svg');
  if (!endOverlay || editTimeToSeconds(endOverlay.start) < 117) {
    errors.push('End lockup must preserve an unobstructed implementation hold through 01:57');
  }
  return errors;
}

const renderPng = async (svgPath, pngPath) => {
  await sharp(svgPath).png().toFile(pngPath);
};

const editTimeToSeconds = (value) => {
  const [minutes, seconds] = value.split(':').map(Number);
  return minutes * 60 + seconds;
};

const writeAnimatic = async (slatePngs, overlayPngs, outputRoot) => {
  const transitionsRoot = resolve(outputRoot, 'transitions');
  mkdirSync(transitionsRoot, { recursive: true });
  const slateData = slatePngs.map((path) => readFileSync(path).toString('base64'));
  const transitionPaths = [];
  for (let boundary = 0; boundary < slatePngs.length - 1; boundary += 1) {
    const frames = [];
    for (let frame = 1; frame <= 6; frame += 1) {
      const opacity = frame / 6;
      const transitionPath = resolve(
        transitionsRoot,
        `transition-${(boundary + 1).toString().padStart(2, '0')}-${frame.toString().padStart(2, '0')}.png`,
      );
      const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><image width="1920" height="1080" href="data:image/png;base64,${slateData[boundary]}"/><image width="1920" height="1080" opacity="${opacity.toFixed(4)}" href="data:image/png;base64,${slateData[boundary + 1]}"/></svg>`);
      await sharp(svg).png().toFile(transitionPath);
      frames.push(transitionPath);
    }
    transitionPaths.push(frames);
  }

  const concatPath = resolve(outputRoot, 'animatic-concat.txt');
  const quotePath = (path) => path.replaceAll('\\', '/').replaceAll("'", "'\\''");
  const concatLines = [];
  slatePngs.forEach((path, index) => {
    const fullDuration = SHOTS[index].end - SHOTS[index].start;
    const stillDuration = fullDuration - (index > 0 ? 0.1 : 0) - (index < SHOTS.length - 1 ? 0.1 : 0);
    concatLines.push(`file '${quotePath(path)}'`, `duration ${stillDuration.toFixed(4)}`);
    if (index < transitionPaths.length) {
      transitionPaths[index].forEach((transitionPath) => {
        concatLines.push(`file '${quotePath(transitionPath)}'`, 'duration 0.0333333333');
      });
    }
  });
  concatLines.push(`file '${quotePath(slatePngs.at(-1))}'`);
  writeFileSync(concatPath, `${concatLines.join('\n')}\n`, 'utf8');

  const outputPath = resolve(outputRoot, 'mcpilot-edit-animatic-1080p.mp4');
  const inputArgs = [];
  inputArgs.push('-f', 'concat', '-safe', '0', '-i', concatPath);
  overlayPngs.forEach((path) => inputArgs.push('-framerate', '30', '-loop', '1', '-t', '119', '-i', path));
  const audioIndex = 1 + overlayPngs.length;
  inputArgs.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');

  const filters = ['[0:v]fps=30,format=yuv420p,setpts=PTS-STARTPTS[base]'];
  let current = 'base';
  overlayPngs.forEach((_, index) => {
    const inputIndex = 1 + index;
    const prepared = `overlay${index}`;
    const next = `composite${index}`;
    const start = editTimeToSeconds(OVERLAYS[index].start);
    const end = editTimeToSeconds(OVERLAYS[index].end);
    filters.push(`[${inputIndex}:v]format=rgba,setpts=PTS-STARTPTS[${prepared}]`);
    filters.push(`[${current}][${prepared}]overlay=enable=between(t\\,${start}\\,${end}):eof_action=pass[${next}]`);
    current = next;
  });
  filters.push(`[${current}]format=yuv420p[final]`);

  const result = spawnSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    ...inputArgs,
    '-filter_complex', filters.join(';'),
    '-map', '[final]', '-map', `${audioIndex}:a:0`,
    '-r', '30',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
    '-c:a', 'aac', '-b:a', '128k',
    '-t', '119', '-movflags', '+faststart', outputPath,
  ], { cwd: root, encoding: 'utf8', timeout: 180_000 });
  if (result.status !== 0) throw new Error(`FFmpeg could not build the animatic: ${result.stderr.trim()}`);
  return outputPath;
};

const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;

export async function writeVideoKit(release, outputRoot, { animatic = true } = {}) {
  const definitionErrors = validateVideoKitDefinition();
  if (definitionErrors.length) throw new Error(definitionErrors.join('\n'));
  mkdirSync(outputRoot, { recursive: true });
  const overlaysRoot = resolve(outputRoot, 'overlays');
  const slatesRoot = resolve(outputRoot, 'slates');
  for (const generatedDirectory of [
    overlaysRoot,
    slatesRoot,
    resolve(outputRoot, 'transitions'),
    resolve(outputRoot, 'qa-current'),
  ]) {
    rmSync(generatedDirectory, { recursive: true, force: true });
  }
  for (const entry of readdirSync(outputRoot, { withFileTypes: true })) {
    if (entry.isFile() && /^qa-.*\.png$/i.test(entry.name)) {
      rmSync(resolve(outputRoot, entry.name), { force: true });
    }
  }
  mkdirSync(overlaysRoot, { recursive: true });
  mkdirSync(slatesRoot, { recursive: true });

  const overlaySvgs = buildOverlaySvgs(release.project.name);
  const overlayPngs = [];
  for (const [name, contents] of overlaySvgs) {
    const svgPath = resolve(overlaysRoot, name);
    const pngPath = svgPath.replace(/\.svg$/, '.png');
    writeFileSync(svgPath, contents, 'utf8');
    await renderPng(svgPath, pngPath);
    overlayPngs.push(pngPath);
  }

  const slatePngs = [];
  const slateSvgs = buildSlateSvgs();
  for (const [index, contents] of slateSvgs.entries()) {
    const stem = `shot-${(index + 1).toString().padStart(2, '0')}-${SHOTS[index].start}-${SHOTS[index].end}`;
    const svgPath = resolve(slatesRoot, `${stem}.svg`);
    const pngPath = resolve(slatesRoot, `${stem}.png`);
    writeFileSync(svgPath, contents, 'utf8');
    await renderPng(svgPath, pngPath);
    slatePngs.push(pngPath);
  }

  const edl = [
    ['file', 'start', 'end', 'placement', 'purpose'].map(csvCell).join(','),
    ...OVERLAYS.map((overlay) => [overlay.file, overlay.start, overlay.end, overlay.placement, overlay.purpose].map(csvCell).join(',')),
  ].join('\n');
  writeFileSync(resolve(outputRoot, 'edit-decisions.csv'), `${edl}\n`, 'utf8');

  const readme = `# ${release.project.name} video kit

This package locks the 1:59 evidence order before final capture. Every slate must be replaced by real product footage. The animatic contains no outcome evidence and must never be uploaded as the competition demo.

## Edit rules

- Master at 1920×1080, 30 fps, H.264/AAC, targeting exactly 1:59.
- Keep the rightmost 680 px clear for the agent pane during split-screen tool calls.
- Use the five overlays in \`edit-decisions.csv\` and no additional thesis cards.
- Use no overlay from 00:37 through 00:44; the approval-to-tool transition must remain uninterrupted.
- Mark removed agent latency with a plain \`AGENT WORKING\` cut marker.
- Crop the native result board; do not invent a metrics graphic.
- Build the thumbnail from the real 06 APPLY ABSENT capture. Do not use \`public/og.png\` in the film.
- Replace all slate footage, add the generated final captions, then run the media acceptance gate.

Palette: ${palette.ink}, ${palette.paper}, ${palette.mint}, ${palette.periwinkle}. Yellow is reserved for wait state; red is reserved for a real regression.
`;
  writeFileSync(resolve(outputRoot, 'README.md'), readme, 'utf8');

  const animaticPath = animatic ? await writeAnimatic(slatePngs, overlayPngs, outputRoot) : null;
  return { overlaySvgs, slatePngs, animaticPath };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === scriptPath;
if (isMain) {
  const args = new Set(process.argv.slice(2));
  const supported = new Set(['--preview', '--no-animatic']);
  const unknown = [...args].filter((arg) => !supported.has(arg));
  if (unknown.length) {
    console.error(`Unknown arguments: ${unknown.join(', ')}`);
    process.exit(2);
  }
  const preview = args.has('--preview');
  const manifest = JSON.parse(readFileSync(resolve(root, 'submission.release.json'), 'utf8'));
  const release = preview ? makePreviewRelease(manifest) : manifest;
  if (!preview && !isResolvedText(release.project?.name, { max: 42 })) {
    console.error('Final video kit requires only the final project name in submission.release.json.');
    process.exit(1);
  }
  const outputRoot = preview
    ? resolve(root, 'outputs', 'video-kit-preview')
    : resolve(root, 'outputs', 'video-kit-final');
  try {
    const result = await writeVideoKit(release, outputRoot, { animatic: !args.has('--no-animatic') });
    console.log(`Video kit written to ${outputRoot}`);
    console.log(`  - ${result.overlaySvgs.size} editor-ready 1920×1080 overlay pairs`);
    console.log(`  - ${result.slatePngs.length} timed 1920×1080 storyboard slates`);
    if (result.animaticPath) console.log(`  - ${result.animaticPath}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
