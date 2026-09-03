import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const preview = new Set(process.argv.slice(2)).has('--preview');
const captureRoot = resolve(root, 'outputs', 'captures');
const outputRoot = resolve(root, 'outputs', 'final');
const workRoot = resolve(root, 'outputs', 'video-master-work');
const channelRoot = resolve(root, 'outputs', 'channel');
mkdirSync(outputRoot, { recursive: true });
rmSync(workRoot, { recursive: true, force: true });
mkdirSync(workRoot, { recursive: true });

const palette = {
  ink: '#05070D',
  paper: '#F7F9FF',
  mint: '#68F2BA',
  periwinkle: '#7589FF',
  muted: '#A8B3C7',
  yellow: '#FFE28A',
};

const fontFace = () => {
  const paths = [
    ['Geist', resolve(root, 'node_modules', 'next', 'dist', 'esm', 'next-devtools', 'server', 'font', 'geist-latin.woff2')],
    ['Geist Mono', resolve(root, 'node_modules', 'next', 'dist', 'esm', 'next-devtools', 'server', 'font', 'geist-mono-latin.woff2')],
  ];
  return paths.map(([name, path]) => `@font-face{font-family:'${name}';src:url(data:font/woff2;base64,${readFileSync(path).toString('base64')}) format('woff2');}`).join('');
};

const fontCss = fontFace();
const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&apos;');

const titleText = (lines) => lines.map((line, index) => (
  `<tspan x="76" dy="${index === 0 ? 0 : 67}">${escapeXml(line)}</tspan>`
)).join('');

const bodyText = (lines) => lines.map((line, index) => (
  `<tspan x="76" dy="${index === 0 ? 0 : 34}">${escapeXml(line)}</tspan>`
)).join('');

const toolRows = (tools = []) => tools.map((tool, index) => `
  <g transform="translate(76 ${734 + index * 55})">
    <rect width="430" height="42" rx="12" fill="#111A2B" stroke="${palette.periwinkle}" stroke-opacity=".34"/>
    <circle cx="23" cy="21" r="5" fill="${palette.mint}"/>
    <text x="42" y="27" class="mono" font-size="19" font-weight="650" fill="${palette.paper}">${escapeXml(tool)}</text>
    <text x="410" y="27" text-anchor="end" class="mono" font-size="14" font-weight="700" letter-spacing="2" fill="${palette.mint}">REAL CALL</text>
  </g>`).join('');

const brandMark = `
  <g transform="translate(76 62)">
    <rect width="70" height="70" rx="18" fill="#090D1A" stroke="${palette.periwinkle}" stroke-width="2"/>
    <rect x="7" y="7" width="56" height="56" rx="14" fill="none" stroke="${palette.mint}" stroke-opacity=".28"/>
    <circle cx="54" cy="16" r="4.5" fill="${palette.mint}"/>
    <text x="35" y="44" text-anchor="middle" class="sans" font-size="22" font-weight="820" fill="${palette.paper}">MP</text>
  </g>`;

const scenes = [
  {
    id: '01-baseline', duration: 8, capture: '06-post-undo-iab.png',
    eyebrow: 'REAL PRODUCT · PLAYED BASELINE', title: ['PLAYER', 'EVIDENCE', 'FIRST.'],
    body: ['One completed run.', 'Device-local. Source-labeled.', 'Evidence, not a diagnosis.'],
    chip: '00:00 · WORKING PRODUCT', accent: 'mint',
  },
  {
    id: '02-request', duration: 4, capture: '06-post-undo-iab.png',
    eyebrow: 'PREPARED REQUEST', title: ['ONE SEND.', 'NO SETUP.'],
    body: ['The strongest material starts now.', 'No typing. No waiting.'],
    chip: 'BROWSER AGENT · READY', accent: 'periwinkle',
  },
  {
    id: '03-real-tools', duration: 18, capture: '02-real-tool-trail-iab.png',
    eyebrow: 'LIVE WEBMCP', title: ['THREE REAL', 'TOOL CALLS.'],
    body: ['Page-defined tools read the real', 'trial and draft a bounded plan.'],
    tools: ['inspect_play_lab', 'read_play_signals', 'propose_access_tune'],
    chip: 'NO MOCK CHAT · LIVE PAGE', accent: 'mint',
  },
  {
    id: '04-exact-diff', duration: 14, capture: '01-apply-absent-iab.png',
    eyebrow: '06 LIVE · APPLY ABSENT', title: ['PROPOSING', 'IS NOT', 'APPLYING.'],
    body: ['Two-hand → one-hand-left', 'Full motion → reduced motion', 'Active values remain untouched.'],
    chip: 'EXACT DIFF · PLAYER REVIEW', accent: 'yellow',
  },
  {
    id: '05-human-gate', duration: 10, capture: '03-apply-added-iab.png',
    eyebrow: 'VISIBLE PLAYER GATE', title: ['APPROVAL', 'CREATES', 'TOOL 7.'],
    body: ['The human decision changes the', 'agent’s actual capability surface.'],
    chip: '06 → 07 · APPLY REGISTERED', accent: 'mint',
  },
  {
    id: '06-bounded-apply', duration: 10, capture: '04-applied-undo-added-iab.png',
    eyebrow: 'EXACT REVISION ONLY', title: ['BOUNDED', 'BY CODE.'],
    body: ['Approved proposal ID required.', 'Changed values are rejected.', 'Second application is rejected.'],
    chip: 'DETERMINISTIC ENFORCEMENT', accent: 'periwinkle',
  },
  {
    id: '07-live-least-privilege', duration: 10, capture: '04-applied-undo-added-iab.png',
    eyebrow: 'ONE-SHOT CAPABILITY', title: ['APPLY OUT.', 'UNDO IN.'],
    body: ['The page removes authority the', 'moment it is no longer needed.'],
    chip: 'REVERSIBLE · VISIBLE', accent: 'mint',
  },
  {
    id: '08-realtime-guide', duration: 22, capture: '00-hero-before-request-iab.png',
    eyebrow: 'OPENAI REALTIME · OPTIONAL', title: ['VOICE THAT', 'EXPLAINS—', 'NOT ACTS.'],
    body: ['Spoken guidance + live captions.', 'Zero play or permission tools.', 'The standard key stays server-side.'],
    chip: 'MARIN VOICE · EXPLAIN ONLY', accent: 'periwinkle',
  },
  {
    id: '09-comparison-gate', duration: 11, capture: '04-applied-undo-added-iab.png',
    eyebrow: 'EVIDENCE BEFORE VERDICT', title: ['THE PLAYER', 'GATES THE', 'COMPARISON.'],
    body: ['Second trial + visible check-in.', 'Sample data never proves outcome.'],
    chip: 'NO CHECK-IN TOOL EXISTS', accent: 'yellow',
  },
  {
    id: '10-implementation', duration: 10, capture: '06-post-undo-iab.png',
    eyebrow: 'IMPERATIVE WEBMCP · REACT', title: ['PERMISSIONS,', 'NOT', 'PROMISES.'],
    body: ['Bounds. Provenance. Reversal.', 'Owned by deterministic page code.'],
    chip: 'HUMAN DECISIONS → AGENT RIGHTS', accent: 'mint',
  },
];

const previewFallback = resolve(captureRoot, '01-apply-absent-iab.png');
for (const scene of scenes) {
  const requested = resolve(captureRoot, scene.capture);
  scene.capturePath = existsSync(requested) ? requested : preview ? previewFallback : requested;
}

const required = [
  ...new Set(scenes.map((scene) => scene.capturePath)),
  resolve(channelRoot, 'mcpilot-youtube-banner-2560x1440.png'),
  resolve(root, 'outputs', 'voice', 'narration-119s.wav'),
  resolve(outputRoot, 'MCPilot-demo-captions.srt'),
];
const missing = required.filter((path) => !existsSync(path));
if (missing.length) throw new Error(`Missing final inputs:\n${missing.join('\n')}`);

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 300_000 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
};

const arena = await sharp(resolve(root, 'public', 'signal-run-arena-v1.webp'))
  .resize(1920, 1080, { fit: 'cover' })
  .modulate({ brightness: 0.32, saturation: 0.7 })
  .blur(1.2)
  .png()
  .toBuffer();

for (const [index, scene] of scenes.entries()) {
  const capture = await sharp(scene.capturePath)
    .resize(1322, 1080, { fit: 'cover', position: scene.id === '04-exact-diff' ? 'east' : 'centre' })
    .sharpen({ sigma: 0.55 })
    .png()
    .toBuffer();
  const accent = palette[scene.accent] || palette.mint;
  const overlay = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
    <defs>
      <linearGradient id="panel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${palette.ink}" stop-opacity="1"/><stop offset=".82" stop-color="${palette.ink}" stop-opacity=".98"/><stop offset="1" stop-color="${palette.ink}" stop-opacity=".25"/></linearGradient>
      <linearGradient id="topline" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${palette.mint}"/><stop offset="1" stop-color="${palette.periwinkle}"/></linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="180%" height="190%"><feDropShadow dx="0" dy="14" stdDeviation="24" flood-color="#000" flood-opacity=".7"/></filter>
      <style>${fontCss}
        .sans{font-family:'Geist','Segoe UI',Arial,sans-serif}.mono{font-family:'Geist Mono','Cascadia Mono',monospace}
      </style>
    </defs>
    <rect x="0" y="0" width="640" height="1080" fill="url(#panel)"/>
    <rect x="597" y="0" width="4" height="1080" fill="url(#topline)" opacity=".9"/>
    <path d="M600 0H1919V1079H600" fill="none" stroke="#FFFFFF" stroke-opacity=".12"/>
    ${brandMark}
    <text x="166" y="89" class="sans" font-size="25" font-weight="760" letter-spacing="3" fill="${palette.paper}">MCPILOT</text>
    <text x="166" y="121" class="mono" font-size="15" font-weight="620" letter-spacing="3" fill="${palette.muted}">ADAPTIVE INTERACTIVE PLAY LAB</text>
    <text x="76" y="222" class="mono" font-size="19" font-weight="720" letter-spacing="3" fill="${accent}">${escapeXml(scene.eyebrow)}</text>
    <text x="76" y="310" class="sans" font-size="61" font-weight="820" letter-spacing="-2.4" fill="${palette.paper}">${titleText(scene.title)}</text>
    <rect x="76" y="${scene.title.length === 3 ? 535 : 468}" width="430" height="4" rx="2" fill="${accent}"/>
    <text x="76" y="${scene.title.length === 3 ? 596 : 529}" class="sans" font-size="25" font-weight="540" fill="${palette.muted}">${bodyText(scene.body)}</text>
    ${toolRows(scene.tools)}
    <g transform="translate(76 970)">
      <rect width="430" height="52" rx="15" fill="${accent}" fill-opacity=".1" stroke="${accent}" stroke-opacity=".55"/>
      <text x="215" y="33" text-anchor="middle" class="mono" font-size="17" font-weight="720" letter-spacing="2" fill="${accent}">${escapeXml(scene.chip)}</text>
    </g>
    <g transform="translate(1814 64)">
      <rect width="58" height="34" rx="17" fill="#05070D" fill-opacity=".72" stroke="${accent}" stroke-opacity=".6"/>
      <text x="29" y="22" text-anchor="middle" class="mono" font-size="14" font-weight="720" fill="${accent}">${String(index + 1).padStart(2, '0')}</text>
    </g>
  </svg>`);
  const scenePath = resolve(workRoot, `${String(index + 1).padStart(2, '0')}-${scene.id}.png`);
  await sharp(arena)
    .composite([
      { input: capture, left: 598, top: 0 },
      { input: overlay, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 7 })
    .toFile(scenePath);
  scene.path = scenePath;
}

const endCard = await sharp(resolve(channelRoot, 'mcpilot-youtube-banner-2560x1440.png'))
  .resize(1920, 1080, { fit: 'cover' })
  .composite([{ input: Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
      <defs><style>${fontCss}.mono{font-family:'Geist Mono','Cascadia Mono',monospace}</style></defs>
      <rect x="660" y="932" width="600" height="46" rx="23" fill="#05070D" fill-opacity=".78" stroke="${palette.periwinkle}" stroke-opacity=".5"/>
      <text x="960" y="961" text-anchor="middle" class="mono" font-size="17" font-weight="650" letter-spacing="2" fill="${palette.paper}">AI-GENERATED NARRATION · OPENAI REALTIME</text>
    </svg>`), left: 0, top: 0 }])
  .png()
  .toBuffer();
const endCardPath = resolve(workRoot, '11-end-card.png');
writeFileSync(endCardPath, endCard);

const clips = [];
for (const [index, scene] of scenes.entries()) {
  const clipPath = resolve(workRoot, `${String(index + 1).padStart(2, '0')}-${scene.id}.mp4`);
  const frames = Math.round(scene.duration * 30);
  const horizontal = index % 2 === 0 ? 'iw/2-(iw/zoom/2)' : 'iw/2-(iw/zoom/2)+8*sin(on/80)';
  run('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', scene.path,
    '-vf', `zoompan=z='min(zoom+0.00011,1.035)':x='${horizontal}':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=30,format=yuv420p`,
    '-frames:v', String(frames), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', clipPath]);
  clips.push(clipPath);
}

const endClipPath = resolve(workRoot, '11-end-card.mp4');
run('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', endCardPath,
  '-vf', 'format=yuv420p', '-t', '2', '-r', '30', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', endClipPath]);
clips.push(endClipPath);

const concatPath = resolve(workRoot, 'picture-lock.txt');
const q = (path) => path.replaceAll('\\', '/').replaceAll("'", "'\\''");
writeFileSync(concatPath, `${clips.map((path) => `file '${q(path)}'`).join('\n')}\n`, 'utf8');
const picturePath = resolve(workRoot, 'picture-lock-119s.mp4');
run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concatPath,
  '-an', '-c:v', 'copy', '-movflags', '+faststart', picturePath]);

const narrationPath = resolve(root, 'outputs', 'voice', 'narration-119s.wav');
const captionsPath = resolve(outputRoot, 'MCPilot-demo-captions.srt').replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "\\'");
const masterPath = resolve(outputRoot, preview ? 'preview-master-1080p.mp4' : 'master-1080p.mp4');
const audioFilter = [
  '[1:a]volume=1.0[vo]',
  "aevalsrc='0.030*sin(2*PI*55*t)*(0.72+0.28*sin(2*PI*0.12*t))+0.009*sin(2*PI*110*t)':s=48000:d=119,lowpass=f=520,highpass=f=38,volume='if(between(t,42,66),0.28,1)':eval=frame,pan=stereo|c0=c0|c1=c0[bed]",
  '[vo][bed]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:LRA=7:TP=-1.5[aout]',
].join(';');
run('ffmpeg', ['-y', '-loglevel', 'error', '-i', picturePath, '-i', narrationPath,
  '-filter_complex', audioFilter,
  '-vf', `subtitles='${captionsPath}':original_size=1920x1080:force_style='FontName=Arial,FontSize=15,PrimaryColour=&H00F7F9FF,BackColour=&H9A000000,BorderStyle=3,Outline=0,Shadow=0,MarginV=22,Alignment=2'`,
  '-map', '0:v:0', '-map', '[aout]', '-t', '119', '-r', '30',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', masterPath]);

if (preview) {
  console.log(masterPath);
  process.exit(0);
}

const thumbnailCapture = await sharp(resolve(captureRoot, '01-apply-absent-iab.png'))
  .resize(3840, 2160, { fit: 'cover', position: 'east' })
  .modulate({ brightness: 0.72, saturation: 1.06 })
  .sharpen({ sigma: 0.65 })
  .png()
  .toBuffer();
const thumbnailOverlay = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${palette.ink}"/><stop offset=".52" stop-color="${palette.ink}" stop-opacity=".94"/><stop offset=".78" stop-color="${palette.ink}" stop-opacity=".18"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></linearGradient>
      <linearGradient id="line" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${palette.mint}"/><stop offset="1" stop-color="${palette.periwinkle}"/></linearGradient>
      <style>${fontCss}.sans{font-family:'Geist','Segoe UI',Arial,sans-serif}.mono{font-family:'Geist Mono','Cascadia Mono',monospace}</style>
    </defs>
    <rect width="3840" height="2160" fill="url(#fade)"/>
    <text x="210" y="350" class="mono" font-size="64" font-weight="720" letter-spacing="9" fill="${palette.mint}">REAL WEBMCP · WORKING DEMO</text>
    <text x="190" y="770" class="sans" font-size="255" font-weight="850" letter-spacing="-10" fill="${palette.paper}">PLAYER</text>
    <text x="190" y="1030" class="sans" font-size="255" font-weight="850" letter-spacing="-10" fill="${palette.paper}">APPROVAL</text>
    <text x="190" y="1290" class="sans" font-size="255" font-weight="850" letter-spacing="-10" fill="${palette.mint}">CREATES</text>
    <text x="190" y="1550" class="sans" font-size="255" font-weight="850" letter-spacing="-10" fill="${palette.periwinkle}">TOOL 7</text>
    <rect x="205" y="1655" width="1580" height="10" rx="5" fill="url(#line)"/>
    <text x="210" y="1785" class="mono" font-size="58" font-weight="650" letter-spacing="5" fill="${palette.paper}">MCPILOT</text>
    <text x="210" y="1875" class="sans" font-size="55" font-weight="580" fill="${palette.muted}">Your decision changes what the agent can do.</text>
  </svg>`);
await sharp(thumbnailCapture).composite([{ input: thumbnailOverlay, left: 0, top: 0 }])
  .png({ compressionLevel: 9, palette: true, quality: 94 })
  .toFile(resolve(outputRoot, 'thumbnail-16x9.png'));

const gallery = [
  ['01-apply-absent-iab.png', 'gallery-01-apply-absent.png'],
  ['03-apply-added-iab.png', 'gallery-02-apply-added.png'],
  ['04-applied-undo-added-iab.png', 'gallery-03-exact-apply.png'],
];
for (const [inputName, outputName] of gallery) {
  await sharp(resolve(captureRoot, inputName))
    .resize(1920, 1080, { fit: 'cover', position: 'east' })
    .sharpen({ sigma: 0.5 })
    .png({ compressionLevel: 8 })
    .toFile(resolve(outputRoot, outputName));
}

console.log(masterPath);
