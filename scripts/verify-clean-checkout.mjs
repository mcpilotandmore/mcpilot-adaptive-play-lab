import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const root = process.cwd();
const temporaryBase = realpathSync(tmpdir());
const temporaryRoot = mkdtempSync(resolve(temporaryBase, 'second-player-clean-checkout-'));
const checkoutRoot = resolve(temporaryRoot, 'checkout');
const archivePath = resolve(temporaryRoot, 'source.tar');
const cleanEnvironment = { ...process.env };
delete cleanEnvironment.OPENAI_API_KEY;

const run = (command, args, cwd = root) => {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: cleanEnvironment,
    stdio: 'inherit',
    timeout: 300_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
};

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

const assertLocalSecretAbsentFromBuild = () => {
  const envPath = resolve(root, '.env.local');
  if (!existsSync(envPath)) return;
  const match = readFileSync(envPath, 'utf8').match(/^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$/m);
  const secret = match?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!secret) return;

  const scan = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filename = resolve(directory, entry.name);
      if (entry.isDirectory()) scan(filename);
      else if (entry.isFile() && readFileSync(filename).includes(Buffer.from(secret))) {
        throw new Error('Clean build contains local OPENAI_API_KEY bytes');
      }
    }
  };

  scan(resolve(checkoutRoot, 'dist'));
};

const nativeFiles = (directory, prefix = '') => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const relativePath = join(prefix, entry.name);
    if (entry.isDirectory()) return nativeFiles(resolve(directory, entry.name), relativePath);
    return entry.isFile() && entry.name.endsWith('.node') ? [relativePath] : [];
  });

const windowsNativePackageBridge = () => {
  if (process.platform !== 'win32' || !['x64', 'arm64'].includes(process.arch)) return;
  const platform = `win32-${process.arch}`;
  const packagePaths = [
    join('@rolldown', `binding-${platform}-msvc`),
    join('@tailwindcss', `oxide-${platform}-msvc`),
    `${platform}-msvc`.replace(/^/, 'lightningcss-'),
    join('vite', 'node_modules', `lightningcss-${platform}-msvc`),
    join('@unrs', `resolver-binding-${platform}-msvc`),
    join('@next', `swc-${platform}-msvc`),
    join('@img', `sharp-${platform}`),
    join('next', 'node_modules', '@img', `sharp-${platform}`),
  ];
  const freshNodeModules = realpathSync(resolve(checkoutRoot, 'node_modules'));
  let bridged = 0;

  for (const packagePath of packagePaths) {
    const freshPackage = resolve(checkoutRoot, 'node_modules', packagePath);
    const trustedPackage = resolve(root, 'node_modules', packagePath);
    const freshExists = existsSync(freshPackage);
    const trustedExists = existsSync(trustedPackage);
    if (!freshExists && !trustedExists) continue;
    if (!freshExists || !trustedExists) {
      throw new Error(`Windows native package exists in only one install: ${packagePath}`);
    }
    const freshPackageReal = realpathSync(freshPackage);
    const fromFreshModules = relative(freshNodeModules, freshPackageReal);
    if (!fromFreshModules
        || fromFreshModules === '..'
        || fromFreshModules.startsWith(`..${sep}`)
        || isAbsolute(fromFreshModules)) {
      throw new Error(`Refusing to bridge unexpected package path: ${freshPackageReal}`);
    }
    const freshNativeFiles = nativeFiles(freshPackage).sort();
    const trustedNativeFiles = nativeFiles(trustedPackage).sort();
    if (!freshNativeFiles.length
        || JSON.stringify(freshNativeFiles) !== JSON.stringify(trustedNativeFiles)) {
      throw new Error(`Native file set differs for ${packagePath}`);
    }
    for (const relativeNativePath of freshNativeFiles) {
      if (sha256(resolve(freshPackage, relativeNativePath))
          !== sha256(resolve(trustedPackage, relativeNativePath))) {
        throw new Error(`Fresh and trusted native bindings differ by SHA-256: ${packagePath}`);
      }
    }
    rmSync(freshPackageReal, { recursive: true, force: true });
    symlinkSync(realpathSync(trustedPackage), freshPackage, 'junction');
    bridged += 1;
  }
  console.log(`Windows policy bridge: ${bridged} native packages matched by SHA-256 and junctioned to trusted paths`);
};

const runNpm = (args, cwd) => {
  const npmCliPath = process.env.npm_execpath;
  if (typeof npmCliPath === 'string' && isAbsolute(npmCliPath) && existsSync(npmCliPath)) {
    run(process.execPath, [npmCliPath, ...args], cwd);
    return;
  }
  if (process.platform === 'win32') {
    throw new Error('npm_execpath does not identify the current npm CLI on Windows');
  }
  run('npm', args, cwd);
};

const safelyRemoveTemporaryRoot = () => {
  const resolvedTemporaryBase = realpathSync(temporaryBase);
  const resolvedTarget = realpathSync(temporaryRoot);
  const fromTemporaryBase = relative(resolvedTemporaryBase, resolvedTarget);
  if (!fromTemporaryBase
      || fromTemporaryBase === '..'
      || fromTemporaryBase.startsWith(`..${sep}`)
      || isAbsolute(fromTemporaryBase)) {
    throw new Error(`Refusing to remove unexpected temporary path: ${resolvedTarget}`);
  }
  rmSync(resolvedTarget, { recursive: true, force: true });
};

try {
  mkdirSync(checkoutRoot);
  run('git', ['archive', '--format=tar', `--output=${archivePath}`, 'HEAD']);
  run('tar', ['-xf', archivePath, '-C', checkoutRoot]);
  runNpm(['ci'], checkoutRoot);
  windowsNativePackageBridge();
  runNpm(['run', 'verify'], checkoutRoot);
  assertLocalSecretAbsentFromBuild();
  console.log('Clean-checkout verification: PASS');
  console.log('Source: tracked files at HEAD, installed from package-lock.json');
} catch (error) {
  console.error(`Clean-checkout verification: FAIL — ${error.message}`);
  process.exitCode = 1;
} finally {
  try {
    safelyRemoveTemporaryRoot();
  } catch (error) {
    console.error(`Temporary cleanup needs attention: ${error.message}`);
    process.exitCode = 1;
  }
}
