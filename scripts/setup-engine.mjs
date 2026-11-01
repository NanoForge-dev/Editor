#!/usr/bin/env node
/**
 * Clones and builds the engine and the CLI the e2e tests and `pnpm example` use, at the commits
 * CI pins (`scripts/pinned-refs.json`), into `.engine/` (ignored by git). It never touches a
 * checkout of yours: set NANOFORGE_ENGINE and NANOFORGE_CLI to use one instead.
 *
 * `--dry-run` prints the commands. Building the engine needs emscripten (`emcc`, see the
 * engine's README).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(ROOT, '.engine');
const REFS = JSON.parse(readFileSync(join(ROOT, 'scripts/pinned-refs.json'), 'utf8'));
const DRY = process.argv.includes('--dry-run');

const run = (command, args, cwd) => {
  console.log(`$ ${[command, ...args].join(' ')}${cwd === ROOT ? '' : `   (in ${cwd})`}`);
  if (!DRY)
    execFileSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, HUSKY: '0' } });
};

/** A clone of `repository` at `ref` in `.engine/<name>`, fetched again when the ref moved. */
const checkout = (name, { repository, ref }) => {
  const folder = join(TARGET, name);
  if (!existsSync(join(folder, '.git')))
    run('git', ['clone', '--filter=blob:none', repository, folder], ROOT);
  else run('git', ['fetch', '--quiet', 'origin'], folder);
  run('git', ['checkout', '--quiet', '--detach', ref], folder);
  return folder;
};

if (!DRY) mkdirSync(TARGET, { recursive: true });

const engine = checkout('engine', REFS.engine);
run('pnpm', ['install', '--frozen-lockfile'], engine);
run('pnpm', ['run', 'build'], engine);

const cli = checkout('cli', REFS.cli);
run('pnpm', ['install', '--frozen-lockfile'], cli);
run('pnpm', ['--filter', '@nanoforge-dev/config', 'build'], cli);
/** `nf new` reads the schematics' dist, which the CLI's own build leaves out. */
run('pnpm', ['--filter', '@nanoforge-dev/schematics', 'build'], cli);
run('pnpm', ['build'], cli);

console.log(`
The e2e tests and \`pnpm example\` now find them by themselves; or set
  NANOFORGE_ENGINE=${engine}
  NANOFORGE_CLI=${cli}`);
