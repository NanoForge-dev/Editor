/**
 * Entry of the editor server (`nf editor` runs `bun dist/index.js`): serves the RPC endpoint,
 * the WebSocket, plugin files and the built UI.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  type SocketData,
  createEditorServer,
  linkWithToken,
  loadEnv,
} from '@nanoforge-dev/editor-server-core';

import pkg from '../package.json' with { type: 'json' };

const env = loadEnv();
const staticDir = process.env.EDITOR_STATIC_DIR ?? join(import.meta.dir, 'client');
const editor = createEditorServer({
  env: {
    ...env,
    bundledPluginsDir: env.bundledPluginsDir ?? join(import.meta.dir, 'plugins'),
    /** Next to the built server, or the sources' `tutorial/` when run from them (dev). */
    tutorialDir:
      env.tutorialDir ??
      [join(import.meta.dir, 'tutorial'), join(import.meta.dir, '../tutorial')].find((dir) =>
        existsSync(dir),
      ),
  },
  version: pkg.version,
  ...(process.env.EDITOR_NO_STATIC ? {} : { staticDir }),
});
await editor.start();

const server = Bun.serve<SocketData>({
  hostname: env.host,
  port: env.port,
  fetch: (request, bun) =>
    editor.fetch(request, (upgradeRequest, options) => bun.upgrade(upgradeRequest, options)),
  websocket: {
    open: (socket) => editor.websocket.open(socket),
    message: (socket, message) => editor.websocket.message(socket, message),
    drain: (socket) => editor.websocket.drain(socket),
    close: (socket) => editor.websocket.close(socket),
  },
});

editor.logs
  .getLogger('server')
  .info(
    `NanoForge editor ${pkg.version} (${env.mode}) on ${
      env.launchToken ? linkWithToken(server.url.href, env.launchToken) : server.url.href
    }`,
  );

const shutdown = () => {
  editor.dispose();
  void server.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
