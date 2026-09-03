import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makePreviewRelease } from './submission-data.mjs';
import { renderSubmissionFiles } from './submission-render.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, '..');
const args = new Set(process.argv.slice(2));
const supportedArgs = new Set(['--preview', '--check']);
const unknownArgs = [...args].filter((arg) => !supportedArgs.has(arg));

if (unknownArgs.length) {
  console.error(`Unknown arguments: ${unknownArgs.join(', ')}`);
  process.exit(2);
}

const preview = args.has('--preview');
const check = args.has('--check');
const manifestPath = resolve(root, 'submission.release.json');
const outputRoot = preview
  ? resolve(root, 'outputs', 'submission-preview')
  : resolve(root, 'submission', 'ready');

let release;
try {
  release = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error(`Could not read submission.release.json: ${error.message}`);
  process.exit(1);
}

if (preview) release = makePreviewRelease(release);

const rendered = renderSubmissionFiles(release);
if (rendered.errors.length) {
  console.error(`${preview ? 'Preview' : 'Final'} submission packet is not renderable:`);
  rendered.errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}

const expectedNames = [...rendered.files.keys()].sort();

if (check) {
  const errors = [];
  if (!existsSync(outputRoot)) {
    errors.push(`Missing packet directory: ${outputRoot}`);
  } else {
    const entries = readdirSync(outputRoot, { withFileTypes: true });
    const nonFiles = entries.filter((entry) => !entry.isFile()).map((entry) => entry.name);
    if (nonFiles.length) errors.push(`Packet directory contains non-file entries: ${nonFiles.join(', ')}`);
    const actualNames = entries.map((entry) => entry.name).sort();
    const unexpected = actualNames.filter((name) => !rendered.files.has(name));
    const missing = expectedNames.filter((name) => !actualNames.includes(name));
    if (unexpected.length) errors.push(`Unexpected packet files: ${unexpected.join(', ')}`);
    if (missing.length) errors.push(`Missing packet files: ${missing.join(', ')}`);

    for (const [name, expected] of rendered.files) {
      const path = resolve(outputRoot, name);
      if (!existsSync(path)) continue;
      const actual = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
      if (actual !== expected) errors.push(`${name} is stale or was edited outside the manifest compiler`);
    }
  }

  if (errors.length) {
    console.error(`${preview ? 'Preview' : 'Final'} submission packet check failed:`);
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }
  console.log(`${preview ? 'Preview' : 'Final'} submission packet is deterministic and current (${expectedNames.length} files).`);
  process.exit(0);
}

mkdirSync(outputRoot, { recursive: true });
const existingEntries = readdirSync(outputRoot, { withFileTypes: true });
const nonFiles = existingEntries.filter((entry) => !entry.isFile()).map((entry) => entry.name);
if (nonFiles.length) {
  console.error(`Refusing to use a packet directory with non-file entries: ${nonFiles.join(', ')}`);
  process.exit(1);
}
const existingNames = existingEntries.map((entry) => entry.name);
const unexpected = existingNames.filter((name) => !rendered.files.has(name));
if (unexpected.length) {
  console.error(`Refusing to overwrite a packet directory with unexpected files: ${unexpected.join(', ')}`);
  process.exit(1);
}

for (const [name, contents] of rendered.files) {
  writeFileSync(resolve(outputRoot, name), contents, 'utf8');
}

console.log(`${preview ? 'Preview' : 'Final'} submission packet written to ${outputRoot}`);
expectedNames.forEach((name) => console.log(`  - ${name}`));
