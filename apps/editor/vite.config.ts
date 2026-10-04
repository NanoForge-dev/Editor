import { sveltekit } from '@sveltejs/kit/vite';
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Plugin, defineConfig, searchForWorkspaceRoot } from 'vite';

import pkg from './package.json' with { type: 'json' };

const API_PORT = Number(process.env.EDITOR_API_PORT ?? 5174);

/** Built-in plugins run as dev plugins in dev: rebuilt by `vite build --watch`, hot reloaded. */
const PLUGINS_ROOT = join(import.meta.dirname, '../../plugins');
const builtInPlugins = existsSync(PLUGINS_ROOT)
  ? readdirSync(PLUGINS_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(PLUGINS_ROOT, entry.name))
  : [];

/**
 * Dev only: runs the editor's Bun server (RPC, WebSocket, plugins) next to Vite, which proxies
 * those routes to it. `bun --watch` restarts it when server code changes.
 */
const editorServer = (): Plugin => {
  let child: ChildProcess | undefined;
  return {
    name: 'nanoforge-editor-server',
    apply: 'serve',
    configureServer(server) {
      child = spawn('bun', ['--watch', 'server/main.ts'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'development',
          PORT: String(API_PORT),
          EDITOR_NO_STATIC: '1',
          FS_ROOT: process.env.FS_ROOT ?? process.env.INIT_CWD ?? process.cwd(),
          DEV_PLUGINS: [...builtInPlugins, process.env.DEV_PLUGINS ?? ''].filter(Boolean).join(','),
        },
      });
      server.httpServer?.once('close', () => child?.kill());
    },
  };
};

/**
 * `ANALYZE=1 pnpm build`: prints, for each big chunk of the client build, its heaviest modules,
 * and how TypeScript got into a chunk when it did (it belongs to the code worker only).
 */
const analyzeBundle = (): Plugin => ({
  name: 'nanoforge-analyze-bundle',
  apply: 'build',
  generateBundle(_options, bundle) {
    const short = (id: string) =>
      id.replace(/^.*\/node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?/, '');
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== 'chunk' || chunk.code.length < 200_000) continue;
      const modules = Object.entries(chunk.modules)
        .map(([id, module]) => ({ id, size: module.renderedLength }))
        .sort((a, b) => b.size - a.size);
      console.log(`\n${chunk.fileName}: ${(chunk.code.length / 1024).toFixed(0)} KiB`);
      for (const module of modules.slice(0, 6))
        console.log(`  ${(module.size / 1024).toFixed(0).padStart(6)} KiB  ${short(module.id)}`);
      const compiler = modules.find(({ id }) => /node_modules\/(typescript|@ts-morph)\//.test(id));
      if (!compiler || chunk.fileName.includes('worker')) continue;
      const chain = [compiler.id];
      for (let id = compiler.id; chain.length < 12;) {
        const importer = this.getModuleInfo(id)?.importers.find((next) => !chain.includes(next));
        if (!importer) break;
        chain.push(importer);
        id = importer;
      }
      console.log(
        `  TypeScript is in this chunk through:\n    ${chain.map(short).join('\n    <- ')}`,
      );
    }
  },
});

export default defineConfig({
  plugins: [sveltekit(), editorServer(), ...(process.env.ANALYZE ? [analyzeBundle()] : [])],
  define: { __EDITOR_VERSION__: JSON.stringify(pkg.version) },
  worker: { format: 'es' },
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd())] },
    proxy: {
      '/rpc/ws': { target: `ws://127.0.0.1:${API_PORT}`, ws: true },
      '/rpc': { target: `http://127.0.0.1:${API_PORT}` },
      '/plugins': { target: `http://127.0.0.1:${API_PORT}` },
      '/runtime': { target: `http://127.0.0.1:${API_PORT}` },
      '/healthz': { target: `http://127.0.0.1:${API_PORT}` },
    },
  },
});
