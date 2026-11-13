#!/usr/bin/env node
/**
 * `pnpm examples`: copies games of a local checkout of the examples repository into `.examples/`
 * (ignored by git, outside the pnpm workspace), then installs each copy's own dependencies, so the
 * editor can be tried on them (`pnpm example <name>`). The checkout is never written to: a copy
 * replaces the previous copy of the same game, without its `node_modules`, `dist` and `.nanoforge`.
 *
 * pnpm examples [--from <checkout>] [--games a,b | --all] [--engine <engine checkout>]
 *
 * - The checkout: `--from`, else `NANOFORGE_EXAMPLES`, else `../examples` when it exists; asked for
 *   in a terminal when none is found.
 * - The games: `--games` (names) or `--all`; a checklist in a terminal otherwise.
 * - `--engine` (or `NANOFORGE_ENGINE`): links the engine libraries of a built engine checkout in
 *   place of the published ones the copy installed.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { linkEngineLibraries } from './engine-bridge.mjs';

const ROOT = resolve(import.meta.dirname, '..');
/** Where the copies go; `pnpm example` and the editor-native test read them there. */
const COPIES = join(ROOT, '.examples');
const GROUPS = ['basics', 'demos', 'games'];
const SKIPPED = new Set(['node_modules', 'dist', '.nanoforge']);

const fail = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

/** The examples of a checkout: the folders of its groups that hold a `package.json`. */
const examplesOf = (checkout) =>
  GROUPS.flatMap((group) => {
    const folder = join(checkout, group);
    if (!existsSync(folder)) return [];
    return readdirSync(folder, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && existsSync(join(folder, entry.name, 'package.json')),
      )
      .map((entry) => ({ name: entry.name, group, path: join(folder, entry.name) }));
  });

/** The folders of a copy that have a `package.json`: its root, and `apps/*` and `libs/*`. */
const packageFolders = (copy) => [
  copy,
  ...['apps', 'libs'].flatMap((group) =>
    existsSync(join(copy, group))
      ? readdirSync(join(copy, group))
          .map((name) => join(copy, group, name))
          .filter((folder) => existsSync(join(folder, 'package.json')))
      : [],
  ),
];

const { values } = parseArgs({
  options: {
    from: { type: 'string' },
    games: { type: 'string' },
    all: { type: 'boolean', default: false },
    engine: { type: 'string' },
  },
});
const interactive = process.stdin.isTTY && process.stdout.isTTY;
/** Asks with a prompt of `@inquirer/prompts`; Ctrl+C ends the script without a stack trace. */
const ask = async (prompt, options) => {
  const prompts = await import('@inquirer/prompts');
  return prompts[prompt](options).catch((error) => {
    if (error?.name === 'ExitPromptError') process.exit(130);
    throw error;
  });
};

const fallback = join(ROOT, '../examples');
let checkout =
  values.from ??
  process.env.NANOFORGE_EXAMPLES ??
  (existsSync(join(fallback, 'basics')) ? fallback : undefined);
if (!checkout && interactive)
  checkout = await ask('input', {
    message: 'Path to a checkout of the examples repository:',
    validate: (path) => existsSync(resolve(path)) || 'No such folder',
  });
if (!checkout)
  fail(
    'No examples checkout: pass --from <path>, or set NANOFORGE_EXAMPLES.\nClone it with: git clone https://github.com/NanoForge-dev/examples',
  );
checkout = resolve(checkout);

const examples = examplesOf(checkout);
if (!examples.length) fail(`${checkout} has no examples (folders of ${GROUPS.join(', ')}).`);
const byName = new Map();
for (const example of examples) {
  if (byName.has(example.name))
    fail(
      `Two examples are named "${example.name}": ${byName.get(example.name).path} and ${example.path}.`,
    );
  byName.set(example.name, example);
}

let chosen;
if (values.all) chosen = examples;
else if (values.games) {
  const names = values.games.split(',').map((name) => basename(name.trim()));
  const unknown = names.filter((name) => !byName.has(name));
  if (unknown.length)
    fail(`No example named ${unknown.join(', ')}. Examples: ${[...byName.keys()].join(', ')}.`);
  chosen = names.map((name) => byName.get(name));
} else if (interactive) {
  chosen = await ask('checkbox', {
    message: 'Examples to copy',
    choices: examples.map((example) => ({
      name: `${example.group}/${example.name}`,
      value: example,
      checked: existsSync(join(COPIES, example.name)),
    })),
  });
} else fail('Choose the examples: --games <name,name> or --all (no terminal to ask in).');
if (!chosen.length) fail('No example chosen.');

const engineOption = values.engine ?? process.env.NANOFORGE_ENGINE;
const engine = engineOption && resolve(engineOption);
if (engine && !existsSync(join(engine, 'packages/core/dist')))
  fail(`No built engine at ${engine}: run "pnpm install" and "pnpm build" in it.`);

for (const example of chosen) {
  const copy = join(COPIES, example.name);
  console.log(`\n${example.group}/${example.name} → ${copy}`);
  rmSync(copy, { recursive: true, force: true });
  cpSync(example.path, copy, {
    recursive: true,
    dereference: true,
    filter: (path) => !SKIPPED.has(basename(path)),
  });
  /**
   * A copy without a pnpm workspace of its own would join the editor's and change its lockfile
   * (pnpm 12 ignores `--ignore-workspace`): one of its own, with the apps and libraries `nf new`
   * makes, keeps it apart.
   */
  const workspace = join(copy, 'pnpm-workspace.yaml');
  if (!existsSync(workspace)) writeFileSync(workspace, 'packages:\n  - apps/*\n  - libs/*\n');
  execFileSync('pnpm', ['install'], { cwd: copy, stdio: 'inherit' });
  if (engine)
    for (const folder of packageFolders(copy)) {
      const linked = linkEngineLibraries(engine, folder);
      if (linked.length) console.log(`  ${folder}: ${linked.join(', ')} from ${engine}`);
    }
}

console.log(
  `\nCopied to ${COPIES}. Open one in the built editor: ${chosen.map((example) => `pnpm example ${example.name}`).join(', ')}`,
);
