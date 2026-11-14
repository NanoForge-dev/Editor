import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import {
  bridgeOf,
  cliRoot,
  engineRoot,
  linkEditorLibrary,
  linkEngineModules,
  linkNodeModules,
  useEditorLibrary,
} from '../../../scripts/engine-bridge.mjs';

const name = process.env.E2E_WORKSPACE || '.workspace';
if (!/^\.workspace(-[\w-]+)?$/.test(name))
  throw new Error(
    `E2E_WORKSPACE must be ".workspace" or ".workspace-<name>" (a folder of e2e/ that this run wipes), not "${name}".`,
  );
const root = join(import.meta.dirname, name);
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

/** The example theme has no code: its build copies its manifest and icons into dist/. */
execFileSync('node', ['build.mjs'], {
  cwd: join(import.meta.dirname, '../../../tooling/example-theme'),
  stdio: 'ignore',
});

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
    include: ['components'],
    suggestedPlugins: ['@nanoforge/ecs'],
  }),
  '@acme/shapes/1.0.0/components/nanoforge.manifest.json': JSON.stringify({
    contents: [{ kind: '@nanoforge/ecs:component', path: 'hull.ts', export: 'Hull' }],
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
  '@acme/sunset/1.0.0/nanoforge.manifest.json': JSON.stringify({
    type: 'plugin',
    name: '@acme/sunset',
    version: '1.0.0',
    description: 'A warm light theme.',
    keywords: ['theme'],
    engines: { editor: '>=0.1.0' },
    contributes: {
      themes: [{ id: 'acme-sunset', label: 'Sunset', extends: 'nanoforge-light', colors: {} }],
    },
  }),
};
for (const [path, content] of Object.entries(registry)) {
  mkdirSync(dirname(join(root, '.registry', path)), { recursive: true });
  writeFileSync(join(root, '.registry', path), content);
}

/** The editor's test games (`game` is the engine's pong-network example at 3.0.0, frozen). */
const FIXTURES = {
  game: join(import.meta.dirname, '../../../packages/server-core/test/fixtures/game'),
  breakout: join(import.meta.dirname, '../../../plugins/scene/test/fixtures/breakout'),
};

/** Copies a test game, without what a build or an editor wrote in it. */
const copyGame = (source, destination) =>
  cpSync(source, destination, {
    recursive: true,
    filter: (path) => !/\/(node_modules|dist|\.nanoforge)$/.test(path),
  });

/**
 * The panels' first-time tips take room the tests did not plan for: the local account starts
 * with them put away, but for History's (`tips.spec.ts`).
 */
const tips = readdirSync(join(import.meta.dirname, '../../../plugins'))
  .map((plugin) => join(import.meta.dirname, '../../../plugins', plugin, 'nanoforge.manifest.json'))
  .filter((file) => existsSync(file))
  .flatMap((file) => JSON.parse(readFileSync(file, 'utf8')).contributes?.widgets ?? [])
  .filter((widget) => widget.tip && widget.id !== 'history-panel.history' && !process.env.E2E_TIPS)
  .map((widget) => widget.id);
const account = createHash('sha256').update('local').digest('hex').slice(0, 16);
mkdirSync(join(root, '.data/settings/accounts'), { recursive: true });
writeFileSync(
  join(root, `.data/settings/accounts/${account}.json`),
  `${JSON.stringify({ revision: '1', values: { 'tips.dismissed': tips } }, null, 2)}\n`,
);

const engine = engineRoot(join(import.meta.dirname, '../../..'));
/**
 * The games take their `node_modules` from the engine's end-to-end test game: links to the
 * engine's packages, its CLI and config (`apps/client` has every library the test games use).
 */
const donor = join(engine, 'e2e/game');
/** Engines without the editor bridge cannot be paused, stepped or stopped. */
const bridge = bridgeOf(engine);
if (existsSync(join(donor, 'node_modules/.bin/nf')) && bridge) {
  const game = join(root, 'game');
  copyGame(FIXTURES.game, game);
  linkNodeModules(join(donor, 'node_modules'), join(game, 'node_modules'));
  /** `shared/protocol.ts` imports the network library from the game's root. */
  linkEngineModules(engine, game, ['network']);
  for (const app of ['apps/client', 'apps/server'])
    linkNodeModules(join(donor, app, 'node_modules'), join(game, app, 'node_modules'));
  /** The game extends the engine's tsconfig, as it did in the engine's examples. */
  const tsconfig = join(game, 'tsconfig.json');
  writeFileSync(
    tsconfig,
    readFileSync(tsconfig, 'utf8').replace(
      '"extends": "../../tsconfig.json"',
      `"extends": "${join(engine, 'tsconfig.json')}"`,
    ),
  );
  symlinkSync(join(engine, 'node_modules'), join(root, 'node_modules'));
  const cli = cliRoot(join(import.meta.dirname, '../../..'));
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
  for (const name of ['edit', 'definition', 'format', 'conflict', 'autosave', 'focus', 'close']) {
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
  if (cli && existsSync(join(cli, 'dist/nf.js'))) {
    /** The tutorial's project, as `projects.createTutorial` makes it, on the engine's libraries. */
    const tutorial = join(root, 'my-first-game');
    execFileSync(
      'node',
      [
        join(cli, 'dist/nf.js'),
        'new',
        ...['--name', 'my-first-game', '--path', 'my-first-game', '--language', 'ts'],
        ...['--package-manager', 'npm', '--no-strict', '--no-server', '--no-git', '--no-docker'],
        '--skip-install',
      ],
      { cwd: root, stdio: 'ignore' },
    );
    cpSync(join(import.meta.dirname, '../tutorial'), tutorial, { recursive: true, force: true });
    writeFileSync(
      join(tutorial, '.gitignore'),
      `${readFileSync(join(tutorial, '.gitignore'), 'utf8')}\ndist/\n`,
    );
    linkNodeModules(join(donor, 'apps/client/node_modules'), join(tutorial, 'node_modules'));
    rmSync(join(tutorial, 'node_modules/@nanoforge-dev/cli'), { recursive: true, force: true });
    symlinkSync(cli, join(tutorial, 'node_modules/@nanoforge-dev/cli'));
    /** Builds run the project's own `nf`: without it they need one on the PATH, which CI has not. */
    mkdirSync(join(tutorial, 'node_modules/.bin'), { recursive: true });
    rmSync(join(tutorial, 'node_modules/.bin/nf'), { force: true });
    symlinkSync(join(cli, 'dist/nf.js'), join(tutorial, 'node_modules/.bin/nf'));
    symlinkSync(
      realpathSync(join(donor, 'node_modules/@nanoforge-dev/config')),
      join(tutorial, 'node_modules/@nanoforge-dev/config'),
    );
    linkEditorLibrary(engine, tutorial);
  } else {
    console.warn('No built CLI in NANOFORGE_CLI: the tutorial e2e test is skipped.');
  }
  if (existsSync(join(engine, 'modules/scene/dist/index.js'))) {
    const breakout = join(root, 'breakout');
    copyGame(FIXTURES.breakout, breakout);
    linkNodeModules(join(donor, 'node_modules'), join(breakout, 'node_modules'));
    const client = join(breakout, 'apps/client');
    linkNodeModules(join(donor, 'apps/client/node_modules'), join(client, 'node_modules'));
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

/**
 * `E2E_REQUIRE_ENGINE=1` (CI): every project the engine tests play must be there, or the run
 * fails here instead of skipping them.
 */
if (process.env.E2E_REQUIRE_ENGINE === '1') {
  const missing = [
    ['game', 'a built engine with the editor bridge (NANOFORGE_ENGINE)'],
    ['my-first-game', 'a built CLI (NANOFORGE_CLI)'],
    ['breakout', "the engine's built scene module"],
  ].filter(([folder]) => !existsSync(join(root, folder, 'package.json')));
  if (missing.length) {
    for (const [folder, need] of missing)
      console.error(`E2E_REQUIRE_ENGINE: no ${folder} project, it needs ${need}`);
    process.exit(1);
  }
}
