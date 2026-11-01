import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');
const BUILD = join(import.meta.dirname, '../dist/index.js');
const SOURCES = [
  'apps/editor/src',
  'apps/editor/server',
  'apps/editor/tutorial',
  'packages',
  'plugins',
  'tooling',
];
const SKIPPED = new Set([
  'node_modules',
  'dist',
  'test',
  'scripts',
  'e2e',
  'coverage',
  '.turbo',
  '.svelte-kit',
]);

/** The newest source file under a folder: code in `src` or `server`, and plugin manifests. */
const newest = (folder: string): { path: string; time: number } => {
  let found = { path: '', time: 0 };
  if (!existsSync(folder)) return found;
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (SKIPPED.has(entry.name)) continue;
    const path = join(folder, entry.name);
    const candidate = entry.isDirectory()
      ? newest(path)
      : (/\.(ts|svelte|css)$/.test(entry.name) && /[\\/](src|server)[\\/]/.test(path)) ||
          entry.name === 'nanoforge.manifest.json'
        ? { path, time: statSync(path).mtimeMs }
        : found;
    if (candidate.time > found.time) found = candidate;
  }
  return found;
};

/**
 * The e2e tests run the production build: they fail on a build older than the code, with the
 * command that makes a new one (`E2E_ALLOW_STALE=1` runs them anyway).
 */
export const checkBuild = (): void => {
  if (process.env.E2E_ALLOW_STALE === '1' || process.env.BENCH) return;
  if (!existsSync(BUILD))
    throw new Error('No build of the editor: pnpm turbo build --filter=@nanoforge-dev/editor...');
  const built = statSync(BUILD).mtimeMs;
  const source = SOURCES.map((folder) => newest(join(ROOT, folder))).reduce((a, b) =>
    b.time > a.time ? b : a,
  );
  if (source.time > built)
    throw new Error(
      `The editor build is older than ${source.path.slice(ROOT.length + 1)}: run pnpm turbo build --filter=@nanoforge-dev/editor... (or E2E_ALLOW_STALE=1 to test the old build)`,
    );
};
