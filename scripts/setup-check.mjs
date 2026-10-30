#!/usr/bin/env node
/**
 * `pnpm setup:check`: checks what working on the editor needs, and says how to get what is missing: Node, pnpm,
 * Bun and git to build and run it; Chrome for the browser tests; a built engine and CLI for the
 * e2e tests that play games (`pnpm setup:engine` makes both). Exits 1 when a requirement fails.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bridgeOf, cliRoot, engineRoot } from './engine-bridge.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

/** The first line a command prints, or undefined when it does not run. */
const output = (command, ...args) => {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim()
      .split('\n')[0];
  } catch {
    return undefined;
  }
};
const major = (version) => Number(/(\d+)/.exec(version ?? '')?.[1]);

let failed = 0;
/** One line per check: ✓, ✗ (required) or ! (optional), and how to fix it. */
const report = (ok, required, label, fix) => {
  if (ok) return console.log(`✓ ${label}`);
  if (required) failed++;
  console.log(`${required ? '✗' : '!'} ${label}\n    ${fix}`);
};

const node = process.versions.node;
const wanted = manifest.engines.node;
report(
  major(node) === major(wanted),
  true,
  `Node ${node} (wants ${wanted})`,
  `Install Node ${wanted} (nvm install ${wanted}).`,
);

const pnpmWanted = manifest.packageManager.split('@')[1];
const pnpm = output('pnpm', '--version');
report(
  major(pnpm) === major(pnpmWanted),
  true,
  `pnpm ${pnpm ?? 'missing'} (wants ${pnpmWanted})`,
  `corepack enable && corepack prepare pnpm@${pnpmWanted} --activate`,
);

const bun = output('bun', '--version');
report(
  !!bun,
  true,
  `Bun ${bun ?? 'missing'} (the editor server runs on it)`,
  'Install Bun: https://bun.sh',
);

const git = output('git', '--version');
report(!!git, true, git ?? 'git missing', 'Install git.');

const chromes = [
  process.env.CHROME,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const chrome = chromes.find((path) => path && existsSync(path));
report(
  !!chrome,
  false,
  chrome
    ? `Chrome at ${chrome} (set CHROME=${chrome} for the tests)`
    : 'No Chrome for the browser tests',
  'Install Chrome, or let Playwright fetch its own: pnpm --filter @nanoforge-dev/editor exec playwright install chromium',
);

const engine = engineRoot(ROOT);
const pong = join(engine, 'example/pong-network/node_modules/.bin/nf');
report(
  existsSync(pong) && !!bridgeOf(engine),
  false,
  `Built engine with the editor bridge at ${engine}`,
  'The e2e tests that play games are skipped without it: pnpm setup:engine (needs emcc), or NANOFORGE_ENGINE=<a built checkout>.',
);
report(
  existsSync(join(engine, 'modules/scene/dist/index.js')),
  false,
  "The engine's scene module is built",
  'The scene e2e tests are skipped without it: build the engine (pnpm setup:engine).',
);

const cli = cliRoot(ROOT);
report(
  !!cli && existsSync(join(cli, 'dist/nf.js')),
  false,
  cli ? `Built CLI at ${cli}` : 'No built CLI (NANOFORGE_CLI)',
  'The tutorial e2e test is skipped without it: pnpm setup:engine, or NANOFORGE_CLI=<a built CLI checkout>.',
);

report(
  !!output('emcc', '--version'),
  false,
  'emscripten (emcc), to build the engine',
  'Only pnpm setup:engine needs it: https://emscripten.org/docs/getting_started/downloads.html',
);

console.log(failed ? `\n${failed} requirement(s) missing.` : '\nReady.');
process.exit(failed ? 1 : 0);
