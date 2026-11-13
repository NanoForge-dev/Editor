import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
/** The games `pnpm examples` copied, with their own dependencies installed. */
const copies = join(root, '.examples');
const port = process.env.PORT ?? '4800';
const fail = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};
const games = existsSync(copies)
  ? readdirSync(copies).filter((name) => existsSync(join(copies, name, 'nanoforge.config.ts')))
  : [];
if (!games.length) fail('No copied example: run "pnpm examples" first.');
const name = process.argv[2];
if (!name || !games.includes(name))
  fail(`${name ? `No copied example "${name}". ` : ''}Usage: pnpm example <${games.join('|')}>`);
const game = join(copies, name);
if (!existsSync(join(game, 'node_modules')))
  fail(`${game} has no node_modules: run "pnpm examples --games ${name}" again.`);
const server = join(root, 'apps/editor/dist/index.js');
if (!existsSync(server))
  fail('The editor is not built. Run: pnpm turbo build --filter=@nanoforge-dev/editor...');

const url = `http://127.0.0.1:${port}/load?path=${name}`;
console.log(`\nExample project: ${game}\n\nOpen ${url}\n`);
const child = spawn('bun', [server], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port, FS_ROOT: copies, DATA_DIR: join(copies, '.data') },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
