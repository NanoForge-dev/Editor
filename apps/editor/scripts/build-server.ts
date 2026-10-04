import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [join(root, 'server/main.ts')],
  outdir: dist,
  naming: 'index.js',
  target: 'bun',
  sourcemap: 'linked',
  external: ['typescript', 'unrun', 'rolldown', 'chokidar', 'fsevents', 'prettier', 'yaml'],
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
cpSync(join(root, 'build'), join(dist, 'client'), { recursive: true });

const RUNTIME_DEPENDENCIES = ['chokidar', 'prettier', 'typescript', 'unrun', 'yaml'];
const installed = async (name: string) =>
  ((await Bun.file(join(root, 'node_modules', name, 'package.json')).json()) as { version: string })
    .version;
const dependencies = Object.fromEntries(
  await Promise.all(RUNTIME_DEPENDENCIES.map(async (name) => [name, await installed(name)])),
);
await Bun.write(
  join(dist, 'package.json'),
  `${JSON.stringify({ name: 'nanoforge-editor-runtime', private: true, type: 'module', dependencies }, null, 2)}\n`,
);

const pluginsRoot = join(root, '../../plugins');
if (existsSync(pluginsRoot)) {
  for (const plugin of readdirSync(pluginsRoot)) {
    const built = join(pluginsRoot, plugin, 'dist');
    const manifest = join(built, 'nanoforge.manifest.json');
    if (!existsSync(manifest)) continue;
    const { name } = (await Bun.file(manifest).json()) as { name: string };
    cpSync(built, join(dist, 'plugins', name), { recursive: true });
  }
}
console.log(`Editor server built in ${dist}`);
