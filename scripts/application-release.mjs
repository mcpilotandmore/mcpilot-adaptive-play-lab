const RELEASE_ONLY_DEV_DEPENDENCIES = new Set(['sharp']);
const RELEASE_ONLY_SCRIPTS = new Set([
  'submission:status',
  'submission:check',
  'submission:pack:preview',
  'submission:pack',
  'submission:pack:check',
  'submission:media-status',
  'submission:media-check',
  'media:preflight',
  'media:images:preview',
  'media:images',
  'video:kit:preview',
  'video:kit',
  'verify:clean',
]);

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
};

const withoutReleaseOnlyDependencies = (dependencies = {}) => Object.fromEntries(
  Object.entries(dependencies).filter(([name]) => !RELEASE_ONLY_DEV_DEPENDENCIES.has(name)),
);

export function applicationPackageDescriptor(packageJson) {
  const copy = structuredClone(packageJson ?? {});
  if (copy.scripts) {
    copy.scripts = Object.fromEntries(
      Object.entries(copy.scripts).filter(([name]) => !RELEASE_ONLY_SCRIPTS.has(name)),
    );
  }
  copy.devDependencies = withoutReleaseOnlyDependencies(copy.devDependencies);
  return canonicalize(copy);
}

export function applicationLockDescriptor(packageLock) {
  const copy = structuredClone(packageLock);
  if (copy?.packages?.['']?.devDependencies) {
    copy.packages[''].devDependencies = withoutReleaseOnlyDependencies(copy.packages[''].devDependencies);
  }
  return canonicalize(copy);
}

export function compareApplicationPackages(beforePackage, afterPackage, beforeLock, afterLock) {
  const errors = [];
  if (JSON.stringify(applicationPackageDescriptor(beforePackage))
      !== JSON.stringify(applicationPackageDescriptor(afterPackage))) {
    errors.push('Application package descriptor changed after the deployed application commit');
  }
  if (JSON.stringify(applicationLockDescriptor(beforeLock))
      !== JSON.stringify(applicationLockDescriptor(afterLock))) {
    errors.push('Application dependency lock changed after the deployed application commit');
  }
  return errors;
}
