import { spawn } from 'node:child_process';
import { existsSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  bridgeOf,
  engineRoot,
  linkEditorLibrary,
  linkEngineModules,
  linkNodeModules,
} from './engine-bridge.mjs';

const root = resolve(import.meta.dirname, '..');
const examples = join(root, 'examples');
/**
 * The examples. Their `node_modules` are those of the engine's pong example (`apps`: the folders
 * linked), plus engine modules it does not use (`modules`, folders of the engine's `modules`).
 */
const GAMES = {
  breakout: { apps: ['apps/client'], modules: ['scene'] },
};
const name = process.argv[2] ?? 'breakout';
const fail = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};
const options = GAMES[name];
if (!options) fail(`No example "${name}". Examples: ${Object.keys(GAMES).join(', ')}.`);
const game = join(examples, name);
if (!existsSync(join(game, 'nanoforge.config.ts')))
  fail(`The example "${name}" is missing: ${game} has no nanoforge.config.ts.`);
const engine = engineRoot(root);
const source = join(engine, 'example/pong-network');
const port = process.env.PORT ?? '4800';

const common = join(engine, 'packages/common/dist/index.js');
const bridge = bridgeOf(engine);
if (!existsSync(join(source, 'node_modules/.bin/nf')) || !existsSync(common))
  fail(
    `No built engine at ${engine}.\nSet NANOFORGE_ENGINE to an engine checkout, and run "pnpm install" and "pnpm build" in it.`,
  );
if (bridge !== 'library')
  fail(
    `The engine at ${engine} has no built editor library (modules/editor), which the example game imports.\nUse an engine 2.0 or later, and run "pnpm build" in it.`,
  );
for (const module of options.modules) {
  if (!existsSync(join(engine, 'modules', module, 'dist/index.js')))
    fail(
      `The engine at ${engine} has no built modules/${module}, which the ${name} example imports.\nUse an engine with it (engine main has it), and run "pnpm build" in it.`,
    );
}
const server = join(root, 'apps/editor/dist/index.js');
if (!existsSync(server))
  fail('The editor is not built. Run: pnpm turbo build --filter=@nanoforge-dev/editor...');

for (const folder of ['', ...options.apps])
  linkNodeModules(join(source, folder, 'node_modules'), join(game, folder, 'node_modules'));
for (const folder of options.apps) {
  linkEditorLibrary(engine, join(game, folder));
  linkEngineModules(engine, join(game, folder), options.modules);
}

const hoisted = join(examples, 'node_modules');
rmSync(hoisted, { recursive: true, force: true });
symlinkSync(join(engine, 'node_modules'), hoisted);

const cli = process.env.NANOFORGE_CLI && resolve(process.env.NANOFORGE_CLI);
if (cli && existsSync(join(cli, 'dist/command.loader.js'))) {
  const local = join(game, 'node_modules/@nanoforge-dev/cli');
  rmSync(local, { recursive: true, force: true });
  symlinkSync(cli, local);
}

const url = `http://127.0.0.1:${port}/load?path=${name}`;
console.log(`\nExample project: ${game}\nEngine: ${engine}\n\nOpen ${url}\n`);
const child = spawn('bun', [server], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: port,
    FS_ROOT: examples,
    DATA_DIR: join(examples, '.data'),
  },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
