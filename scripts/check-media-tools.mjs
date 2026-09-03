import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import sharp from 'sharp';

const toolVersion = (command, runner) => {
  const result = runner(command, ['-version'], {
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    return {
      error: `${command} is unavailable on PATH`,
      version: null,
    };
  }
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  return {
    error: null,
    version: output.split(/\r?\n/, 1)[0] || 'version reported',
  };
};

export function inspectMediaTools({ runner = spawnSync, sharpVersions = sharp.versions } = {}) {
  const errors = [];
  const versions = {};
  for (const command of ['ffmpeg', 'ffprobe']) {
    const result = toolVersion(command, runner);
    if (result.error) errors.push(result.error);
    else versions[command] = result.version;
  }
  if (!sharpVersions?.sharp || !sharpVersions?.vips) {
    errors.push('Sharp/libvips could not report its runtime versions');
  } else {
    versions.sharp = `sharp ${sharpVersions.sharp} / libvips ${sharpVersions.vips}`;
  }
  return { errors, versions };
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === resolve(import.meta.dirname, 'check-media-tools.mjs');
if (isMain) {
  const result = inspectMediaTools();
  console.log(`Media toolchain: ${result.errors.length ? 'BLOCKED' : 'READY'}`);
  Object.entries(result.versions).forEach(([tool, version]) => console.log(`  ${tool}: ${version}`));
  result.errors.forEach((error) => console.error(`  - ${error}`));
  if (result.errors.length) process.exitCode = 1;
}
