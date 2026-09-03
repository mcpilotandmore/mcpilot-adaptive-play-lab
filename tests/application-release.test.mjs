import test from 'node:test';
import assert from 'node:assert/strict';
import { compareApplicationPackages } from '../scripts/application-release.mjs';

const packageJson = () => ({
  name: 'app',
  version: '1.0.0',
  type: 'module',
  engines: { node: '>=22' },
  scripts: { dev: 'tool dev', build: 'tool build', start: 'tool start' },
  dependencies: { react: '19.0.0' },
  devDependencies: { vite: '8.0.0' },
});

const packageLock = () => ({
  lockfileVersion: 3,
  packages: {
    '': {
      dependencies: { react: '19.0.0' },
      devDependencies: { vite: '8.0.0' },
    },
    'node_modules/react': { version: '19.0.0', integrity: 'abc' },
    'node_modules/vite': { version: '8.0.0', integrity: 'def', dev: true },
  },
});

test('release-only scripts and the image compositor dependency do not falsify app drift', () => {
  const beforePackage = packageJson();
  const afterPackage = packageJson();
  afterPackage.scripts['submission:pack'] = 'node scripts/pack.mjs';
  afterPackage.scripts['media:preflight'] = 'node scripts/check-media-tools.mjs';
  afterPackage.devDependencies.sharp = '0.35.2';
  const beforeLock = packageLock();
  const afterLock = packageLock();
  afterLock.packages[''].devDependencies.sharp = '0.35.2';

  assert.deepEqual(compareApplicationPackages(beforePackage, afterPackage, beforeLock, afterLock), []);
});

test('runtime dependency or application build changes remain release-blocking', () => {
  const beforePackage = packageJson();
  const afterPackage = packageJson();
  afterPackage.dependencies.react = '20.0.0';
  afterPackage.scripts.build = 'different build';
  const errors = compareApplicationPackages(beforePackage, afterPackage, packageLock(), packageLock());
  assert.match(errors.join('\n'), /package descriptor changed/);
});

test('prebuild, postinstall, overrides, and optional dependency changes remain blocking', () => {
  for (const mutate of [
    (value) => { value.scripts.prebuild = 'node mutate-build.mjs'; },
    (value) => { value.scripts.postinstall = 'node mutate-install.mjs'; },
    (value) => { value.overrides = { react: '20.0.0' }; },
    (value) => { value.optionalDependencies = { canvas: '3.0.0' }; },
  ]) {
    const afterPackage = packageJson();
    mutate(afterPackage);
    assert.match(
      compareApplicationPackages(packageJson(), afterPackage, packageLock(), packageLock()).join('\n'),
      /package descriptor changed/,
    );
  }
});

test('transitive lock drift remains release-blocking', () => {
  const afterLock = packageLock();
  afterLock.packages['node_modules/react'].integrity = 'changed';
  const errors = compareApplicationPackages(packageJson(), packageJson(), packageLock(), afterLock);
  assert.match(errors.join('\n'), /dependency lock changed/);
});
