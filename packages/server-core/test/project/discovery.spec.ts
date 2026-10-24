import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { executingConfigLoader, staticConfigLoader } from '../../src/project/config-loader';
import { discoverProject, resolveLibraries } from '../../src/project/discovery';
import { packageManagerOf } from '../../src/rpc/package-manager-of';

const FIXTURE = join(import.meta.dirname, '../fixtures', 'pong-network');

const temporary: string[] = [];
afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

const copyFixture = () => {
  const root = mkdtempSync(join(import.meta.dirname, '../.tmp-'));
  temporary.push(root);
  cpSync(FIXTURE, root, { recursive: true });
  return root;
};

describe.each([
  ['executing', executingConfigLoader],
  ['static', staticConfigLoader],
])('discoverProject (%s config loader)', (_name, loader) => {
  it('discovers the client and server apps of pong-network', async () => {
    const model = await discoverProject({
      id: 'pong-1234',
      root: FIXTURE,
      location: FIXTURE,
      loader,
    });
    expect(model.diagnostics).toEqual([]);
    expect(model.name).toBe('pong-network');
    expect(model.apps.map((app) => [app.id, app.type, app.name])).toEqual([
      ['apps/client', 'client', 'pong-network-client'],
      ['apps/server', 'server', 'pong-network-server'],
    ]);
    const [client, server] = model.apps;
    expect(client).toMatchObject({
      root: 'apps/client',
      language: 'ts',
      entryFile: 'apps/client/src/main.ts',
      editorEntryFile: 'apps/client/src/main.ts',
      outDir: 'apps/client/dist',
      dirs: {
        assets: 'apps/client/assets',
        components: 'apps/client/src/components',
        systems: 'apps/client/src/systems',
        scenes: 'apps/client/src/scenes',
      },
    });
    expect(Object.keys(client!.engineLibs)).toEqual(
      expect.arrayContaining([
        '@nanoforge-dev/ecs',
        '@nanoforge-dev/graphics-2d',
        '@nanoforge-dev/input',
      ]),
    );
    expect(client!.engineLibs).not.toHaveProperty('@nanoforge-dev/utils-eslint-config');
    expect(server!.engineLibs).not.toHaveProperty('@nanoforge-dev/graphics-2d');
  });

  it("reads the shared libraries of an app from its config's libs", async () => {
    const root = copyFixture();
    writeFileSync(
      join(root, 'nanoforge.config.ts'),
      'import { defineConfig } from "@nanoforge-dev/config";\n\nexport default defineConfig({ type: "workspace", packages: ["apps/*", "libs/*"] });\n',
    );
    mkdirSync(join(root, 'libs/shared'), { recursive: true });
    writeFileSync(
      join(root, 'libs/shared/nanoforge.config.ts'),
      'export default { type: "lib" };\n',
    );
    writeFileSync(join(root, 'libs/shared/package.json'), '{ "name": "@pong/shared" }\n');
    const config = join(root, 'apps/client/nanoforge.config.ts');
    writeFileSync(
      config,
      readFileSync(config, 'utf8').replace(
        'type: "client",',
        'type: "client",\n  libs: ["../../libs/shared"],',
      ),
    );
    const pkg = join(root, 'apps/client/package.json');
    const json = JSON.parse(readFileSync(pkg, 'utf8')) as Record<string, Record<string, string>>;
    writeFileSync(
      pkg,
      JSON.stringify({
        ...json,
        dependencies: { ...json.dependencies, '@pong/shared': 'workspace:*' },
      }),
    );
    const model = await discoverProject({ id: 'pong-libs', root, location: root, loader });
    expect(model.diagnostics).toEqual([]);
    expect(model.apps.map((app) => [app.id, app.libraries])).toEqual([
      ['apps/client', ['@pong/shared']],
      ['apps/server', []],
      ['libs/shared', []],
    ]);
    expect(model.apps[0]!.engineLibs).not.toHaveProperty('../../libs/shared');
  });
});

describe('discoverProject diagnostics', () => {
  it('reports broken app configs without failing', async () => {
    const root = copyFixture();
    writeFileSync(
      join(root, 'apps/server/nanoforge.config.ts'),
      'export default { type: "nope" };',
    );
    const model = await discoverProject({
      id: 'pong-1234',
      root,
      location: root,
      loader: staticConfigLoader,
    });
    expect(model.apps.map((app) => app.id)).toEqual(['apps/client']);
    expect(model.diagnostics).toEqual([
      {
        path: 'apps/server/nanoforge.config.ts',
        message: 'Unknown config type "nope"',
        severity: 'error',
      },
    ]);
  });

  it('refuses non literal configs in static mode', async () => {
    const root = copyFixture();
    writeFileSync(
      join(root, 'nanoforge.config.ts'),
      'import { defineConfig } from "@nanoforge-dev/config";\nexport default defineConfig({ type: "workspace", packages: [process.env.X] });',
    );
    const model = await discoverProject({
      id: 'pong-1234',
      root,
      location: root,
      loader: staticConfigLoader,
    });
    expect(model.apps).toEqual([]);
    expect(model.diagnostics[0]!.message).toMatch(/Only literal values.*process\.env\.X/);
  });

  it('loads configs of projects without installed dependencies', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-fresh-'));
    temporary.push(root);
    writeFileSync(
      join(root, 'nanoforge.config.ts'),
      'import { defineConfig } from "@nanoforge-dev/config";\nconst lang: "ts" = "ts";\nexport default defineConfig({ type: "server", language: lang });',
    );
    const model = await discoverProject({
      id: 'fresh-1234',
      root,
      location: root,
      loader: executingConfigLoader,
    });
    expect(model.diagnostics).toEqual([]);
    expect(model.apps).toMatchObject([{ type: 'server', language: 'ts' }]);
  });

  it('supports single app projects', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-single-'));
    temporary.push(root);
    writeFileSync(
      join(root, 'nanoforge.config.ts'),
      'export default { type: "client", language: "js" };',
    );
    writeFileSync(
      join(root, 'package.json'),
      '{"name":"solo","dependencies":{"@nanoforge-dev/ecs":"^1.4.0"}}',
    );
    const model = await discoverProject({
      id: 'solo-1234',
      root,
      location: root,
      loader: staticConfigLoader,
    });
    expect(model.apps).toMatchObject([
      {
        id: '',
        root: '',
        language: 'js',
        entryFile: 'src/main.ts',
        engineLibs: { '@nanoforge-dev/ecs': '^1.4.0' },
      },
    ]);
  });
});

describe('resolveLibraries', () => {
  const app = (root: string, name: string, type: 'client' | 'server' | 'lib') =>
    ({ id: root, root, name, type, libraries: [] }) as never as Parameters<
      typeof resolveLibraries
    >[0][number];
  const uses = (
    root: string,
    packages: string[],
    libs?: string[],
  ): [
    string,
    Parameters<typeof resolveLibraries>[1] extends ReadonlyMap<string, infer U> ? U : never,
  ] => [
    root,
    {
      configFile: `${root}/nanoforge.config.ts`,
      packages,
      ...(libs && {
        libs: libs.map((path) => ({ path, root: path.replace(/^(\.\.\/)+/, '') })),
      }),
    },
  ];
  const libraries = (apps: { name: string; libraries: string[]; unclaimed?: boolean }[]) =>
    apps.map((entry) => [entry.name, entry.libraries, entry.unclaimed]);

  it("gives each app the shared libraries its config's libs lists", () => {
    const apps = [
      app('apps/client', 'client', 'client'),
      app('apps/server', 'server', 'server'),
      app('libs/shared', '@pong/shared', 'lib'),
      app('libs/ui', '@pong/ui', 'lib'),
    ];
    const diagnostics = resolveLibraries(
      apps,
      new Map([
        uses(
          'apps/client',
          ['@pong/shared', '@pong/ui', 'typescript'],
          ['../../libs/shared', '../../libs/ui'],
        ),
        uses('apps/server', ['@pong/shared', '@nanoforge-dev/core'], ['../../libs/shared']),
        uses('libs/shared', []),
        uses('libs/ui', ['@pong/shared']),
      ]),
    );
    expect(diagnostics).toEqual([]);
    expect(libraries(apps)).toEqual([
      ['client', ['@pong/shared', '@pong/ui'], undefined],
      ['server', ['@pong/shared'], undefined],
      ['@pong/shared', [], undefined],
      ['@pong/ui', ['@pong/shared'], undefined],
    ]);
  });

  it('follows libs when package.json disagrees, and says so', () => {
    const apps = [
      app('apps/client', 'client', 'client'),
      app('apps/server', 'server', 'server'),
      app('libs/shared', '@pong/shared', 'lib'),
    ];
    const diagnostics = resolveLibraries(
      apps,
      new Map([
        uses('apps/client', [], ['../../libs/shared', '../../libs/gone']),
        uses('apps/server', ['@pong/shared'], []),
        uses('libs/shared', []),
      ]),
    );
    expect(libraries(apps)).toEqual([
      ['client', ['@pong/shared'], undefined],
      ['server', [], undefined],
      ['@pong/shared', [], undefined],
    ]);
    expect(diagnostics.map((diagnostic) => [diagnostic.path, diagnostic.message])).toEqual([
      [
        'apps/client/nanoforge.config.ts',
        'libs lists "../../libs/gone", which is not a shared library of the project.',
      ],
      [
        'apps/client/nanoforge.config.ts',
        'client uses @pong/shared (libs), but its package.json does not depend on it: add "@pong/shared": "workspace:*".',
      ],
      [
        'apps/server/nanoforge.config.ts',
        "server's package.json depends on @pong/shared, but its libs does not list libs/shared: the editor does not give it to the app.",
      ],
    ]);
  });

  it('gives a library nothing mentions to every app (projects made before the choice existed)', () => {
    const apps = [
      app('apps/client', 'client', 'client'),
      app('apps/server', 'server', 'server'),
      app('libs/shared', '@pong/shared', 'lib'),
    ];
    expect(
      resolveLibraries(
        apps,
        new Map([
          uses('apps/client', ['typescript'], []),
          uses('apps/server', [], []),
          uses('libs/shared', []),
        ]),
      ),
    ).toEqual([]);
    expect(libraries(apps)).toEqual([
      ['client', ['@pong/shared'], undefined],
      ['server', ['@pong/shared'], undefined],
      ['@pong/shared', [], true],
    ]);
  });
});

describe('packageManagerOf', () => {
  it('finds the package manager of a project from its lockfile', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-lock-'));
    try {
      expect(packageManagerOf(root)).toBeUndefined();
      for (const [lockfile, manager] of [
        ['package-lock.json', 'npm'],
        ['yarn.lock', 'yarn'],
        ['bun.lock', 'bun'],
        ['pnpm-lock.yaml', 'pnpm'],
      ] as const) {
        writeFileSync(join(root, lockfile), '');
        expect(packageManagerOf(root)).toBe(manager);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
