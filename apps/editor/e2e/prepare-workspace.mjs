import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import {
  bridgeOf,
  linkEditorLibrary,
  linkEngineModules,
  linkNodeModules,
  useEditorLibrary,
} from '../../../scripts/engine-bridge.mjs';

const root = join(import.meta.dirname, process.env.E2E_WORKSPACE ?? '.workspace');
rmSync(root, { recursive: true, force: true });
cpSync(
  join(import.meta.dirname, '../../../packages/server-core/test/fixtures/pong-network'),
  join(root, 'pong'),
  {
    recursive: true,
  },
);

const fixture = join(root, 'pong');
const files = {
  'apps/client/assets/logo.png': Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGNk+M/wn4GBgYGJgYGBAQAh/QL/0xAMSQAAAABJRU5ErkJggg==',
    'base64',
  ),
  'scratch/rename-me.txt': 'rename\n',
  'history/format.ts': 'export const value = 1;\n',
  'scratch/move-me.txt': 'move\n',
  'scratch/copy-me.txt': 'copy\n',
  'scratch/delete-me.txt': 'delete\n',
  'scratch/target/.keep': '',
  'secret/hidden.txt': 'nfignored\n',
  '.nfignore': 'secret/\n',
  '.env': 'NANOFORGE_EXAMPLE=1\n',
  '.prettierrc': '{}\n',
  'nf_modules/physics/body.ts': 'export const body = 1;\n',
};
for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(join(fixture, path)), { recursive: true });
  writeFileSync(join(fixture, path), content);
}

const registry = {
  '@acme/badge/1.0.0/nanoforge.manifest.json': JSON.stringify({
    type: 'plugin',
    name: '@acme/badge',
    version: '1.0.0',
    displayName: 'Badge',
    description: 'Adds a badge command.',
    engines: { editor: '>=0.1.0' },
    entry: { client: 'index.js' },
    activation: ['onStartup'],
    contributes: { commands: [{ id: 'badge.show', title: 'Show badge', category: 'Badge' }] },
  }),
  '@acme/badge/1.0.0/index.js':
    "export const activate = (ctx) => { ctx.registerCommand('badge.show', () => undefined); };\n",
  '@acme/badge/1.0.0/README.md': 'Badge\n\nA plugin of the test registry.\n',
  '@acme/badge/registry.json': JSON.stringify({ author: 'Acme', downloads: 1250 }),
  '@acme/shapes/1.0.0/nanoforge.manifest.json': JSON.stringify({
    type: 'package',
    name: '@acme/shapes',
    version: '1.0.0',
    description: 'Shape components.',
    items: ['components/hull.ts'],
  }),
  '@acme/shapes/1.0.0/components/hull.ts': [
    '/**',
    ' * Hit points of an entity.',
    ' * @component',
    ' * @side shared',
    ' */',
    'export class Hull {',
    '  name = "Hull";',
    '  constructor(public points = 3) {}',
    '}',
    '',
  ].join('\n'),
  '@acme/render/1.0.0/nanoforge.manifest.json': JSON.stringify({
    type: 'package',
    name: '@acme/render',
    version: '1.0.0',
    description: 'Draws shapes.',
    dependencies: { '@acme/shapes': '^1.0.0' },
  }),
  '@acme/render/1.0.0/README.md': 'Draws the shapes of @acme/shapes.\n',
};
for (const [path, content] of Object.entries(registry)) {
  mkdirSync(dirname(join(root, '.registry', path)), { recursive: true });
  writeFileSync(join(root, '.registry', path), content);
}

/**
 * Copies a game of the engine repository. Links that point outside of it (node_modules of the
 * pnpm workspace) become absolute, and so do relative tsconfig `extends`.
 */
const copyGame = (source, destination) => {
  cpSync(source, destination, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (path) => !/\/(\.nanoforge|dist)$/.test(path),
  });
  const relink = (dir, sourceDir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const original = join(sourceDir, entry.name);
      if (entry.isSymbolicLink()) {
        const target = resolve(dirname(original), readlinkSync(original));
        if (!target.startsWith(`${source}/`)) {
          rmSync(path);
          symlinkSync(realpathSync(original), path);
        }
      } else if (entry.isDirectory()) relink(path, original);
    }
  };
  relink(destination, source);
  for (const file of ['tsconfig.json', 'apps/client/tsconfig.json', 'apps/server/tsconfig.json']) {
    const path = join(destination, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8').replace(
      /"extends":\s*"(\.[^"]+)"/,
      (_, relative) => `"extends": "${resolve(dirname(join(source, file)), relative)}"`,
    );
    writeFileSync(path, text);
  }
};

const engine = resolve(
  process.env.NANOFORGE_ENGINE ?? join(import.meta.dirname, '../../../../engine'),
);
const pong = join(engine, 'example/pong-network');
/** Engines without the editor bridge cannot be paused, stepped or stopped. */
const bridge = bridgeOf(engine);
if (existsSync(join(pong, 'node_modules/.bin/nf')) && bridge) {
  const game = join(root, 'game');
  copyGame(pong, game);
  symlinkSync(join(engine, 'node_modules'), join(root, 'node_modules'));
  const cli = process.env.NANOFORGE_CLI && resolve(process.env.NANOFORGE_CLI);
  if (cli && existsSync(join(cli, 'dist/command.loader.js'))) {
    const local = join(game, 'node_modules/@nanoforge-dev/cli');
    rmSync(local, { recursive: true, force: true });
    symlinkSync(cli, local);
  }
  if (bridge === 'library') {
    for (const app of ['apps/client', 'apps/server']) {
      linkEditorLibrary(engine, join(game, app));
      useEditorLibrary(join(game, app, 'src/main.ts'));
    }
  }
  const clientMain = join(game, 'apps/client/src/main.ts');
  writeFileSync(
    clientMain,
    readFileSync(clientMain, 'utf8').replace(
      'await app.run();',
      'console.log("pong client ready");\n  await app.run();',
    ),
  );
  const scratch = join(game, 'apps/client/src/scratch');
  mkdirSync(scratch, { recursive: true });
  for (const name of ['edit', 'definition', 'format', 'conflict', 'autosave', 'focus']) {
    writeFileSync(
      join(scratch, `${name}.ts`),
      'import { NanoforgeFactory } from "@nanoforge-dev/core";\n\nexport const factory = NanoforgeFactory;\n',
    );
  }
  writeFileSync(
    join(game, '.env'),
    [
      'NANOFORGE_CLIENT_SERVER_TCP_PORT=4644',
      'NANOFORGE_CLIENT_SERVER_UDP_PORT=4645',
      'NANOFORGE_CLIENT_SERVER_ADDRESS=127.0.0.1',
      'NANOFORGE_SERVER_LISTENING_TCP_PORT=4644',
      'NANOFORGE_SERVER_LISTENING_UDP_PORT=4645',
      '',
    ].join('\n'),
  );
  if (existsSync(join(engine, 'modules/scene/dist/index.js'))) {
    const breakout = join(root, 'breakout');
    cpSync(join(import.meta.dirname, '../../../examples/breakout'), breakout, {
      recursive: true,
      filter: (path) => !/\/(node_modules|dist|\.nanoforge)$/.test(path),
    });
    linkNodeModules(join(pong, 'node_modules'), join(breakout, 'node_modules'));
    const client = join(breakout, 'apps/client');
    linkNodeModules(join(pong, 'apps/client/node_modules'), join(client, 'node_modules'));
    linkEditorLibrary(engine, client);
    linkEngineModules(engine, client, ['scene']);
  } else {
    console.warn(`No built scene module at ${engine}: the scene e2e tests are skipped.`);
  }
} else {
  console.warn(
    `No built engine with the editor bridge at ${engine}: the runtime e2e test is skipped.`,
  );
}
