import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'outputs', 'channel');
mkdirSync(out, { recursive: true });

const colors = {
  ink: '#05070D',
  paper: '#F7F9FF',
  mint: '#68F2BA',
  periwinkle: '#7589FF',
  muted: '#A8B3C7',
};

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const fontFace = () => {
  const sources = [
    ['Geist', resolve(root, 'node_modules', 'next', 'dist', 'esm', 'next-devtools', 'server', 'font', 'geist-latin.woff2')],
    ['Geist Mono', resolve(root, 'node_modules', 'next', 'dist', 'esm', 'next-devtools', 'server', 'font', 'geist-mono-latin.woff2')],
  ];
  return sources.map(([name, path]) => (
    `@font-face{font-family:'${name}';src:url(data:font/woff2;base64,${readFileSync(path).toString('base64')}) format('woff2');}`
  )).join('');
};

const fontCss = fontFace();

const brandMark = ({ x, y, size, initials = 'MP' }) => `
  <g transform="translate(${x} ${y})">
    <rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.24}" fill="#090D1A" stroke="${colors.periwinkle}" stroke-width="${size * 0.018}"/>
    <rect x="${size * 0.075}" y="${size * 0.075}" width="${size * 0.85}" height="${size * 0.85}" rx="${size * 0.19}" fill="none" stroke="${colors.mint}" stroke-opacity=".28" stroke-width="${size * 0.012}"/>
    <circle cx="${size * 0.78}" cy="${size * 0.2}" r="${size * 0.037}" fill="${colors.mint}"/>
    <text x="${size / 2}" y="${size * 0.62}" text-anchor="middle" class="brand" font-size="${size * 0.255}" fill="${colors.paper}">${escapeXml(initials)}</text>
  </g>`;

const bannerOverlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440" viewBox="0 0 2560 1440">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${colors.ink}" stop-opacity=".98"/>
      <stop offset=".2" stop-color="${colors.ink}" stop-opacity=".72"/>
      <stop offset=".52" stop-color="${colors.ink}" stop-opacity=".46"/>
      <stop offset=".8" stop-color="${colors.ink}" stop-opacity=".75"/>
      <stop offset="1" stop-color="${colors.ink}" stop-opacity=".98"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="53%">
      <stop offset="0" stop-color="${colors.periwinkle}" stop-opacity=".22"/>
      <stop offset=".62" stop-color="${colors.mint}" stop-opacity=".06"/>
      <stop offset="1" stop-color="${colors.ink}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="${colors.mint}"/><stop offset="1" stop-color="${colors.periwinkle}"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity=".55"/></filter>
    <style>${fontCss}
      .sans{font-family:'Geist','Segoe UI',Arial,sans-serif}.mono{font-family:'Geist Mono','Cascadia Mono',monospace}.brand{font-family:'Geist','Segoe UI',Arial,sans-serif;font-weight:800;letter-spacing:-4px}
    </style>
  </defs>
  <rect width="2560" height="1440" fill="url(#shade)"/>
  <rect width="2560" height="1440" fill="url(#glow)"/>
  <g opacity=".16" stroke="#FFFFFF" stroke-width="1">
    <path d="M0 496H2560M0 944H2560"/><path d="M506 0V1440M2054 0V1440"/>
  </g>
  <g filter="url(#shadow)">
    ${brandMark({ x: 594, y: 598, size: 248 })}
    <text x="900" y="646" class="mono" font-size="25" font-weight="650" letter-spacing="6" fill="${colors.mint}">WEBMCP / 2026</text>
    <text x="892" y="766" class="sans" font-size="116" font-weight="800" letter-spacing="-5" fill="${colors.paper}">MCPILOT</text>
    <rect x="900" y="805" width="934" height="5" rx="2.5" fill="url(#line)"/>
    <text x="900" y="866" class="mono" font-size="29" font-weight="650" letter-spacing="5" fill="${colors.muted}">ADAPTIVE INTERACTIVE PLAY LAB</text>
  </g>
  <text x="1974" y="909" text-anchor="end" class="sans" font-size="29" font-weight="620" fill="${colors.paper}">Your approval changes what the agent can do.</text>
</svg>`);

const avatarSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <radialGradient id="bg" cx="30%" cy="22%" r="90%"><stop stop-color="#17214A"/><stop offset=".55" stop-color="#090D1B"/><stop offset="1" stop-color="${colors.ink}"/></radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors.mint}"/><stop offset="1" stop-color="${colors.periwinkle}"/></linearGradient>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#000" flood-opacity=".58"/></filter>
    <style>${fontCss}.brand{font-family:'Geist','Segoe UI',Arial,sans-serif;font-weight:820;letter-spacing:-12px}</style>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <circle cx="400" cy="400" r="337" fill="none" stroke="url(#ring)" stroke-width="12" opacity=".9"/>
  <circle cx="400" cy="400" r="306" fill="#080C17" stroke="#FFFFFF" stroke-opacity=".08" stroke-width="2" filter="url(#shadow)"/>
  <circle cx="566" cy="237" r="22" fill="${colors.mint}"/>
  <text x="400" y="490" text-anchor="middle" class="brand" font-size="246" fill="${colors.paper}">MP</text>
</svg>`);

const watermarkSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <defs><style>${fontCss}.brand{font-family:'Geist','Segoe UI',Arial,sans-serif;font-weight:820;letter-spacing:-5px}</style></defs>
  <rect x="22" y="22" width="256" height="256" rx="66" fill="#090D1A" stroke="${colors.periwinkle}" stroke-width="6"/>
  <rect x="38" y="38" width="224" height="224" rx="52" fill="none" stroke="${colors.mint}" stroke-opacity=".3" stroke-width="4"/>
  <circle cx="222" cy="78" r="12" fill="${colors.mint}"/>
  <text x="150" y="185" text-anchor="middle" class="brand" font-size="92" fill="${colors.paper}">MP</text>
</svg>`);

const arenaSource = resolve(root, 'public', 'signal-run-arena-v1.webp');

await sharp(arenaSource)
  .resize(2560, 1440, { fit: 'cover', position: 'centre' })
  .modulate({ brightness: 0.63, saturation: 0.78 })
  .sharpen({ sigma: 0.7 })
  .composite([{ input: bannerOverlay, left: 0, top: 0 }])
  .png({ compressionLevel: 9, palette: true, quality: 94 })
  .toFile(resolve(out, 'mcpilot-youtube-banner-2560x1440.png'));

await sharp(avatarSvg)
  .png({ compressionLevel: 9, palette: true, quality: 100 })
  .toFile(resolve(out, 'mcpilot-avatar-800x800.png'));

await sharp(watermarkSvg)
  .png({ compressionLevel: 9, palette: true, quality: 100 })
  .toFile(resolve(out, 'mcpilot-watermark-300x300.png'));

console.log(out);
