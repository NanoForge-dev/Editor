import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  PluginsContract,
  ProjectsContract,
  RegistryContract,
  SessionContract,
} from '@nanoforge-dev/editor-protocol';
import { type RpcClient, defineContract } from '@nanoforge-dev/editor-rpc';

import { loadEnv } from '../../src/env/load-env';
import { createEditorServer } from '../../src/server/create-editor-server';
import type { EditorServer } from '../../src/server/editor-server.type';
import { createLoopbackClient } from '../../src/testing';

const FIXTURES = join(import.meta.dirname, '../fixtures');

let workspace: string;
let dataDir: string;
let registryDir: string;

const publish = (
  name: string,
  version: string,
  manifest: object,
  files: Record<string, string>,
) => {
  const folder = join(registryDir, name, version);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, 'nanoforge.manifest.json'),
    JSON.stringify({ name, version, ...manifest }),
  );
  for (const [file, text] of Object.entries(files)) writeFileSync(join(folder, file), text);
};

const start = async (extra: Record<string, string> = {}) => {
  const env = loadEnv(
    {
      NODE_ENV: 'test',
      FS_ROOT: workspace,
      DATA_DIR: dataDir,
      REGISTRY_DIR: registryDir,
      ...extra,
    },
    workspace,
  );
  const editor = createEditorServer({
    env,
    version: '1.0.0',
    staticDir: join(workspace, 'static'),
  });
  await editor.start();
  return { editor, client: createLoopbackClient(editor) };
};

let editor: EditorServer;
let client: RpcClient;
let project: string;

beforeAll(async () => {
  workspace = mkdtempSync(join(import.meta.dirname, '../.tmp-registry-'));
  cpSync(join(FIXTURES, 'pong-network'), join(workspace, 'pong'), { recursive: true });
  mkdirSync(join(workspace, 'static'));
  writeFileSync(join(workspace, 'static/index.html'), '<html>editor</html>');
  dataDir = join(mkdtempSync(join(tmpdir(), 'nf-data-')), 'editor');
  registryDir = join(workspace, 'registry');

  const plugin = { type: 'plugin', description: 'Greets from the server' };
  publish(
    '@acme/greeter',
    '1.0.0',
    {
      ...plugin,
      engines: { editor: '^1.0.0' },
      entry: { client: 'index.js', server: 'server.js' },
    },
    {
      'index.js': 'export const activate = () => {};',
      'server.js': `import { z } from 'zod';
export const activate = (context) => {
  context.implement(
    { namespace: context.namespace, methods: { hi: { input: z.null(), output: z.string() } }, events: {} },
    { methods: { hi: () => 'hi from 1.0.0' } },
  );
};`,
    },
  );
  publish(
    '@acme/greeter',
    '2.0.0',
    { ...plugin, engines: { editor: '^2.0.0' }, entry: { client: 'index.js' } },
    { 'index.js': 'export const activate = () => {};' },
  );
  publish('@acme/shapes', '1.0.0', { type: 'package', description: 'Shapes' }, { 'circle.ts': '' });
  publish(
    '@acme/render',
    '1.0.0',
    { type: 'package', dependencies: { '@acme/shapes': '^1.0.0' } },
    { 'draw.ts': '' },
  );

  ({ editor, client } = await start());
  project = (await client.api(ProjectsContract).open({ path: 'pong' })).id;
});

afterAll(() => {
  client.dispose();
  editor.dispose();
  rmSync(workspace, { recursive: true, force: true });
});

describe('registry', () => {
  it('searches by type and describes an item with the version this editor runs', async () => {
    const registry = client.api(RegistryContract);
    const plugins = await registry.search({ type: 'plugin' });
    expect(plugins.items.map((item) => [item.name, item.version])).toEqual([
      ['@acme/greeter', '2.0.0'],
    ]);
    expect((await registry.search({ type: 'package', q: 'shapes' })).items).toHaveLength(1);
    expect(await registry.details({ name: '@acme/greeter' })).toMatchObject({
      version: '2.0.0',
      compatible: '1.0.0',
    });
    await expect(registry.details({ name: '@acme/none' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('installs a plugin for the user, runs its server entry, and uninstalls it', async () => {
    const registry = client.api(RegistryContract);
    const names = async () =>
      (await client.api(PluginsContract).list(null)).map(
        (listing) => `${listing.source}:${(listing.manifest as { name: string }).name}`,
      );
    expect(await names()).toEqual([]);
    expect(await registry.installPlugin({ name: '@acme/greeter', scope: 'user' })).toEqual({
      version: '1.0.0',
    });
    expect(await names()).toEqual(['installed:@acme/greeter']);
    expect(existsSync(join(dataDir, 'plugins/@acme/greeter/index.js'))).toBe(true);
    const greeter = defineContract('plugin.@acme/greeter', {
      methods: { hi: { input: z.null(), output: z.string() } },
    });
    await expect(client.api(greeter).hi(null)).resolves.toBe('hi from 1.0.0');

    await expect(
      registry.installPlugin({ name: '@acme/shapes', scope: 'user' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      registry.installPlugin({ name: '@acme/greeter', scope: 'user', version: '9.0.0' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await registry.uninstallPlugin({ name: '@acme/greeter', scope: 'user' });
    expect(await names()).toEqual([]);
    expect(editor.serverPlugins.active).toEqual([]);
    await expect(
      registry.uninstallPlugin({ name: '@acme/greeter', scope: 'user' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('installs a plugin in a project', async () => {
    const registry = client.api(RegistryContract);
    await expect(
      registry.installPlugin({ name: '@acme/greeter', scope: 'project' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await registry.installPlugin({ name: '@acme/greeter', scope: 'project', project });
    const folder = join(workspace, 'pong/.nanoforge/plugins/@acme/greeter');
    expect(existsSync(join(folder, 'nanoforge.manifest.json'))).toBe(true);
    const listed = await client.api(PluginsContract).list({ project });
    expect(listed.map((listing) => listing.source)).toEqual(['project']);
    await registry.uninstallPlugin({ name: '@acme/greeter', scope: 'project', project });
    expect(existsSync(folder)).toBe(false);
  });

  it('installs, lists and removes the packages of a project', async () => {
    const registry = client.api(RegistryContract);
    expect(await registry.packages({ project })).toEqual([]);
    const installed = await registry.installPackage({ project, name: '@acme/render' });
    expect(installed.map((entry) => [entry.name, entry.version, entry.range])).toEqual([
      ['@acme/render', '1.0.0', '^1.0.0'],
      ['@acme/shapes', '1.0.0', undefined],
    ]);
    const root = join(workspace, 'pong');
    expect(existsSync(join(root, 'nf_modules/@acme/shapes/circle.ts'))).toBe(true);
    expect(readFileSync(join(root, 'tsconfig.json'), 'utf8')).toContain(
      '"@acme/render/*": ["./nf_modules/@acme/render/*"]',
    );
    await expect(registry.installPackage({ project, name: '@acme/greeter' })).rejects.toMatchObject(
      { code: 'BAD_REQUEST', message: expect.stringContaining('is a plugin') as string },
    );
    await expect(
      registry.uninstallPackage({ project, name: '@acme/shapes' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    rmSync(join(root, 'nf_modules'), { recursive: true });
    expect((await registry.packages({ project })).map((entry) => entry.present)).toEqual([
      false,
      false,
    ]);
    expect((await registry.restorePackages({ project })).map((entry) => entry.present)).toEqual([
      true,
      true,
    ]);
    expect(await registry.uninstallPackage({ project, name: '@acme/render' })).toEqual([]);
    expect(existsSync(join(root, 'nf_modules/@acme'))).toBe(false);
  });

  it('says the registry is unavailable, and still lists what is installed', async () => {
    const offline = await start({ REGISTRY_DIR: '', REGISTRY_URL: 'http://127.0.0.1:9' });
    expect((await offline.client.api(SessionContract).info(null)).features).toEqual(['registry']);
    try {
      const registry = offline.client.api(RegistryContract);
      await expect(registry.search({ type: 'plugin' })).rejects.toMatchObject({
        code: 'UNAVAILABLE',
      });
      const id = (await offline.client.api(ProjectsContract).open({ path: 'pong' })).id;
      expect(await registry.packages({ project: id })).toEqual([]);
    } finally {
      offline.client.dispose();
      offline.editor.dispose();
    }
  });

  it('asks no registry until the API has one (API_FEATURES)', async () => {
    expect((await client.api(SessionContract).info(null)).features).toEqual(['registry']);
    const none = await start({ REGISTRY_DIR: '' });
    try {
      expect((await none.client.api(SessionContract).info(null)).features).toEqual([]);
      await expect(none.client.api(RegistryContract).search({ type: 'plugin' })).rejects.toThrow(
        'The registry is not available yet',
      );
    } finally {
      none.client.dispose();
      none.editor.dispose();
    }
    const env = (features: string) => loadEnv({ API_FEATURES: features }, workspace);
    expect(env('settings, registry')).toMatchObject({
      apiFeatures: ['settings', 'registry'],
      registryUrl: 'https://api.nanoforge.eu',
    });
    expect(env('settings').registryUrl).toBeUndefined();
    expect(() => env('settings,teleport')).toThrow(/unknown feature "teleport"/);
  });

  it('never installs for a visitor of a hosted editor', async () => {
    const hosted = await start({
      PUBLIC_MODE: 'ONLINE',
      API_KEY: 'key',
      SESSION_SECRET: 'x'.repeat(32),
    });
    try {
      const registry = hosted.client.api(RegistryContract);
      await expect(
        registry.installPlugin({ name: '@acme/greeter', scope: 'user' }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    } finally {
      hosted.client.dispose();
      hosted.editor.dispose();
    }
  });
});
