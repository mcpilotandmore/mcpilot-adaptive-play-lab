import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { isResolvedText, makePreviewRelease } from './submission-data.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(scriptPath), '..');
const colors = Object.freeze({
  ink: '#05070D',
  paper: '#F7F9FF',
  mint: '#68F2BA',
  periwinkle: '#7589FF',
  muted: '#A8B0C4',
});

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const fontStyle = () => {
  const paths = [
    ['Geist', resolve(root, 'node_modules', 'next', 'dist', 'esm', 'next-devtools', 'server', 'font', 'geist-latin.woff2')],
    ['Geist Mono', resolve(root, 'node_modules', 'next', 'dist', 'esm', 'next-devtools', 'server', 'font', 'geist-mono-latin.woff2')],
  ];
  return paths.filter(([, path]) => existsSync(path)).map(([name, path]) => (
    `@font-face{font-family:'${name}';src:url(data:font/woff2;base64,${readFileSync(path).toString('base64')}) format('woff2');}`
  )).join('');
};

export const buildThumbnailOverlay = (projectName) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${colors.ink}" stop-opacity=".96"/><stop offset=".58" stop-color="${colors.ink}" stop-opacity=".68"/><stop offset="1" stop-color="${colors.ink}" stop-opacity=".05"/></linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${colors.mint}"/><stop offset="1" stop-color="${colors.periwinkle}"/></linearGradient>
    <style>${fontStyle()}.sans{font-family:'Geist','Segoe UI',Arial,sans-serif}.mono{font-family:'Geist Mono','Cascadia Mono',monospace}</style>
  </defs>
  <rect width="790" height="720" fill="url(#shade)"/>
  <rect x="68" y="86" width="260" height="44" rx="22" fill="${colors.ink}" fill-opacity=".88" stroke="${colors.mint}" stroke-opacity=".7"/>
  <text x="92" y="115" class="mono" font-size="17" font-weight="650" letter-spacing="2.5" fill="${colors.mint}">06 · APPLY ABSENT</text>
  <text x="68" y="366" class="sans" font-size="64" font-weight="760" letter-spacing="-2" fill="${colors.paper}">PLAYER APPROVAL</text>
  <text x="68" y="438" class="sans" font-size="64" font-weight="760" letter-spacing="-2" fill="${colors.paper}">CREATES TOOL 7</text>
  <rect x="68" y="476" width="510" height="8" rx="4" fill="url(#edge)"/>
  <text x="68" y="634" class="sans" font-size="24" font-weight="620" fill="${colors.paper}">${escapeXml(projectName)}</text>
  <text x="68" y="668" class="mono" font-size="15" font-weight="560" letter-spacing="2" fill="${colors.muted}">OPENAI WEBMCP CHALLENGE</text>
</svg>`);

export const buildGalleryOverlay = (label, placement) => {
  const y = placement === 'top' ? 108 : 874;
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${colors.mint}"/><stop offset="1" stop-color="${colors.periwinkle}"/></linearGradient>
    <style>${fontStyle()}.mono{font-family:'Geist Mono','Cascadia Mono',monospace}</style>
  </defs>
  <rect x="0" y="0" width="1920" height="8" fill="url(#edge)"/>
  <rect x="192" y="${y}" width="520" height="86" rx="22" fill="${colors.ink}" fill-opacity=".94" stroke="#FFFFFF" stroke-opacity=".16"/>
  <circle cx="238" cy="${y + 43}" r="9" fill="${colors.mint}"/>
  <text x="270" y="${y + 53}" class="mono" font-size="24" font-weight="650" letter-spacing="2.2" fill="${colors.paper}">${escapeXml(label)}</text>
</svg>`);
};

const placeholderCapture = (label) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="${colors.ink}"/>
  <rect x="96" y="96" width="1728" height="888" rx="36" fill="#0C1120" stroke="${colors.periwinkle}" stroke-opacity=".35"/>
  <text x="960" y="490" text-anchor="middle" font-family="Segoe UI,Arial" font-size="54" font-weight="700" fill="${colors.paper}">REAL PRODUCT CAPTURE GOES HERE</text>
  <text x="960" y="570" text-anchor="middle" font-family="Cascadia Mono,monospace" font-size="25" fill="${colors.mint}">${escapeXml(label)}</text>
  <text x="960" y="640" text-anchor="middle" font-family="Cascadia Mono,monospace" font-size="18" fill="${colors.muted}">PREVIEW ONLY · NEVER PUBLISH</text>
</svg>`);

const checkedPath = (raw, label) => {
  if (typeof raw !== 'string' || !raw.trim() || isAbsolute(raw)) throw new Error(`${label} must be a workspace-relative path`);
  const absolute = resolve(root, raw);
  const fromRoot = relative(root, absolute);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) throw new Error(`${label} escapes the workspace`);
  return absolute;
};

const inputCapture = async (sourcePath, label, preview) => {
  if (preview) return sharp(placeholderCapture(label)).png().toBuffer();
  if (!existsSync(sourcePath)) throw new Error(`Missing real capture: ${relative(root, sourcePath)}`);
  const metadata = await sharp(sourcePath).metadata();
  if ((metadata.width ?? 0) < 1920 || (metadata.height ?? 0) < 1080) {
    throw new Error(`${relative(root, sourcePath)} must be at least 1920x1080`);
  }
  if (Math.abs((metadata.width / metadata.height) - (16 / 9)) > 0.01) {
    throw new Error(`${relative(root, sourcePath)} must use a 16:9 frame`);
  }
  return sourcePath;
};

export async function composeMediaImages({ preview = false } = {}) {
  const captureConfig = JSON.parse(readFileSync(resolve(root, 'submission.capture.json'), 'utf8'));
  const mediaConfig = JSON.parse(readFileSync(resolve(root, 'submission.media.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(resolve(root, 'submission.release.json'), 'utf8'));
  const release = preview ? makePreviewRelease(manifest) : manifest;

  if (captureConfig.schemaVersion !== 1) throw new Error('submission.capture.json schemaVersion must be 1');
  if (!isResolvedText(release.project?.name, { max: 42 })) throw new Error('Choose the final project name before composing final images');
  if (!Array.isArray(captureConfig.gallery) || captureConfig.gallery.length !== 3) {
    throw new Error('submission.capture.json must define exactly three gallery images');
  }
  const configuredOutputs = captureConfig.gallery.map((item) => item.outputPath);
  if (JSON.stringify(configuredOutputs) !== JSON.stringify(mediaConfig.galleryPaths)) {
    throw new Error('Gallery outputs must exactly match submission.media.json');
  }
  if (captureConfig.thumbnail.outputPath !== mediaConfig.thumbnailPath) {
    throw new Error('Thumbnail output must exactly match submission.media.json');
  }

  const outputRoot = preview ? resolve(root, 'outputs', 'image-kit-preview') : null;
  const thumbnailSource = checkedPath(captureConfig.thumbnail.sourcePath, 'thumbnail.sourcePath');
  const thumbnailOutput = preview
    ? resolve(outputRoot, 'thumbnail-16x9.png')
    : checkedPath(captureConfig.thumbnail.outputPath, 'thumbnail.outputPath');
  mkdirSync(dirname(thumbnailOutput), { recursive: true });
  const thumbnailInput = await inputCapture(thumbnailSource, '06 · APPLY ABSENT', preview);
  await sharp(thumbnailInput)
    .resize(1280, 720, { fit: 'cover' })
    .composite([{ input: buildThumbnailOverlay(release.project.name) }])
    .png({ compressionLevel: 9 })
    .toFile(thumbnailOutput);

  const galleryOutputs = [];
  for (const [index, item] of captureConfig.gallery.entries()) {
    if (!['top', 'bottom'].includes(item.placement)) throw new Error(`gallery[${index}].placement must be top or bottom`);
    if (!isResolvedText(item.label, { max: 40 })) throw new Error(`gallery[${index}].label must be resolved text`);
    const source = checkedPath(item.sourcePath, `gallery[${index}].sourcePath`);
    const output = preview
      ? resolve(outputRoot, `gallery-${index + 1}.png`)
      : checkedPath(item.outputPath, `gallery[${index}].outputPath`);
    mkdirSync(dirname(output), { recursive: true });
    const input = await inputCapture(source, item.label, preview);
    await sharp(input)
      .resize(1920, 1080, { fit: 'cover' })
      .composite([{ input: buildGalleryOverlay(item.label, item.placement) }])
      .png({ compressionLevel: 9 })
      .toFile(output);
    galleryOutputs.push(output);
  }
  return { thumbnailOutput, galleryOutputs };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === scriptPath;
if (isMain) {
  const preview = process.argv.includes('--preview');
  const unknown = process.argv.slice(2).filter((arg) => arg !== '--preview');
  if (unknown.length) {
    console.error(`Unknown arguments: ${unknown.join(', ')}`);
    process.exit(2);
  }
  try {
    const result = await composeMediaImages({ preview });
    console.log(`${preview ? 'Preview' : 'Final'} public image package rendered:`);
    console.log(`  - ${result.thumbnailOutput}`);
    result.galleryOutputs.forEach((path) => console.log(`  - ${path}`));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
