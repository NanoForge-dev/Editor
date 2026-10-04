import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  FsContract,
  PluginsContract,
  ProjectsContract,
  SessionContract,
} from '@nanoforge-dev/editor-protocol';
import { type RpcClient, defineContract } from '@nanoforge-dev/editor-rpc';

import { loadEnv } from '../../src/env/load-env';
import { createEditorServer } from '../../src/server/create-editor-server';
import type { EditorServer } from '../../src/server/editor-server.type';
import { TEST_ORIGIN as ORIGIN, createLoopbackClient } from '../../src/testing';

const FIXTURES = join(import.meta.dirname, '../fixtures');

let workspace: string;
let editor: EditorServer;
let client: RpcClient;

beforeAll(async () => {
  workspace = mkdtempSync(join(import.meta.dirname, '../.tmp-server-'));
  cpSync(join(FIXTURES, 'pong-network'), join(workspace, 'pong'), { recursive: true });
  const staticDir = join(workspace, 'static');
  mkdirSync(join(staticDir, '_app'), { recursive: true });
  writeFileSync(join(staticDir, 'index.html'), '<html>editor</html>');
  writeFileSync(join(staticDir, '_app/app.js'), 'console.log(1)');

  const env = loadEnv(
    {
      NODE_ENV: 'test',
      FS_ROOT: workspace,
      DATA_DIR: join(mkdtempSync(join(tmpdir(), 'nf-data-')), 'editor'),
      BUNDLED_PLUGINS_DIR: join(FIXTURES, 'plugins'),
    },
    workspace,
  );
  editor = createEditorServer({ env, version: '0.0.0-test', staticDir });
  await editor.start();

  client = createLoopbackClient(editor);
});

afterAll(() => {
  client.dispose();
  editor.dispose();
  rmSync(workspace, { recursive: true, force: true });
});

describe('editor server', () => {
  it('opens pong-network and exposes its model', async () => {
    const session = await client.api(SessionContract).info(null);
    expect(session).toMatchObject({ mode: 'OFFLINE', user: { id: 'local' }, loginUrl: null });

    const projects = client.api(ProjectsContract);
    const { id } = await projects.open({ path: 'pong' });
    const model = await projects.model({ id });
    expect(model.apps.map((app) => [app.id, app.type])).toEqual([
      ['apps/client', 'client'],
      ['apps/server', 'server'],
    ]);
    expect(model.apps[0]!.engineLibs).toHaveProperty('@nanoforge-dev/ecs');
    expect((await projects.recent(null)).map((project) => project.id)).toEqual([id]);
    expect((await projects.open({ path: 'pong' })).id).toBe(id);
  });

  it('streams disk changes to clients within 200 ms', async () => {
    const { id } = await client.api(ProjectsContract).open({ path: 'pong' });
    const received: string[] = [];
    const subscription = client.subscribe(FsContract, 'changes', { project: id }, ({ changes }) =>
      received.push(...changes.map((change) => `${change.type}:${change.path}`)),
    );
    await new Promise((resolve) => setTimeout(resolve, 300)); // watcher initial scan
    const start = Date.now();
    writeFileSync(join(workspace, 'pong/apps/client/src/new.ts'), 'export {};');
    while (!received.length && Date.now() - start < 2000)
      await new Promise((r) => setTimeout(r, 5));
    subscription.dispose();
    expect(received).toEqual(['created:apps/client/src/new.ts']);
    expect(Date.now() - start).toBeLessThan(200);
  });

  it('reads and writes files through rpc', async () => {
    const { id } = await client.api(ProjectsContract).open({ path: 'pong' });
    const fs = client.api(FsContract);
    const file = await fs.read({ project: id, path: 'apps/client/src/main.ts' });
    expect(new TextDecoder().decode(file.content)).toContain('NanoforgeFactory');
    await fs.write({ project: id, path: 'notes.md', content: '# hi', expectedHash: null });
    await expect(fs.read({ project: id, path: '../outside' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('runs plugin server entries in their namespace', async () => {
    const echo = defineContract('plugin.@acme/echo', {
      methods: { echo: { input: z.object({ text: z.string() }), output: z.string() } },
    });
    await expect(client.api(echo).echo({ text: 'hello' })).resolves.toMatch(/^hello from /);
    expect(editor.serverPlugins.active).toEqual(['@acme/echo']);
  });

  it('lists the plugins of the open project and serves them to it', async () => {
    const { id } = await client.api(ProjectsContract).open({ path: 'pong' });
    const dir = join(workspace, 'pong/.nanoforge/plugins/@acme/local');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'nanoforge.manifest.json'),
      JSON.stringify({
        type: 'plugin',
        name: '@acme/local',
        version: '1.0.0',
        engines: { editor: '*' },
        entry: { client: 'index.js' },
      }),
    );
    writeFileSync(join(dir, 'index.js'), 'export const activate = () => {};');
    try {
      const plugins = client.api(PluginsContract);
      const names = (listings: { manifest: unknown }[]) =>
        listings.map((listing) => (listing.manifest as { name: string }).name);
      expect(names(await plugins.list(null))).toEqual(['@acme/echo']);
      const listings = await plugins.list({ project: id });
      expect(names(listings)).toEqual(['@acme/echo', '@acme/local']);
      expect(listings[1]).toMatchObject({
        source: 'project',
        baseUrl: `/plugins/project/${id}/@acme/local/1.0.0/`,
      });
      const get = (path: string) =>
        editor.fetch(new Request(`${ORIGIN}${path}`)) as Promise<Response>;
      expect((await get(`/plugins/project/${id}/@acme/local/1.0.0/index.js`)).status).toBe(200);
      expect((await get('/plugins/project/unknown/@acme/local/1.0.0/index.js')).status).toBe(404);
      await expect(plugins.list({ project: 'unknown' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    } finally {
      rmSync(join(workspace, 'pong/.nanoforge/plugins'), { recursive: true, force: true });
    }
  });

  it('collects the plugins that installed packages suggest', async () => {
    const { id } = await client.api(ProjectsContract).open({ path: 'pong' });
    const write = (path: string, manifest: object) => {
      mkdirSync(join(workspace, 'pong/nf_modules', path), { recursive: true });
      writeFileSync(
        join(workspace, 'pong/nf_modules', path, 'nanoforge.manifest.json'),
        JSON.stringify({ type: 'package', version: '1.0.0', ...manifest }),
      );
    };
    write('@nanoforge/motion', { name: '@nanoforge/motion', suggestedPlugins: ['@nanoforge/ecs'] });
    write('@nanoforge/render-2d', {
      name: '@nanoforge/render-2d',
      include: ['shapes'],
      suggestedPlugins: { '@nanoforge/ecs': '^1.0.0' },
    });
    write('@nanoforge/render-2d/shapes', {
      name: '@nanoforge/shapes',
      suggestedPlugins: ['@nanoforge/graphics-gizmos'],
    });
    write('@evil/escape', { name: '@evil/escape', include: ['../../..'] });
    try {
      expect(await client.api(PluginsContract).suggestions({ project: id })).toEqual([
        {
          name: '@nanoforge/ecs',
          suggestedBy: [
            { package: '@nanoforge/motion', range: '*' },
            { package: '@nanoforge/render-2d', range: '^1.0.0' },
          ],
        },
        {
          name: '@nanoforge/graphics-gizmos',
          suggestedBy: [{ package: '@nanoforge/shapes', range: '*' }],
        },
      ]);
    } finally {
      rmSync(join(workspace, 'pong/nf_modules'), { recursive: true, force: true });
    }
  });

  it('serves plugin files, the SPA and refuses foreign origins', async () => {
    const get = (path: string, headers: Record<string, string> = {}) =>
      editor.fetch(new Request(`${ORIGIN}${path}`, { headers })) as Promise<Response>;
    const plugin = await get('/plugins/bundled/@acme/echo/1.0.0/index.js');
    expect(plugin.status).toBe(200);
    expect(plugin.headers.get('content-type')).toContain('javascript');
    expect(
      (await get('/plugins/bundled/@acme/echo/1.0.0/../../../../../package.json')).status,
    ).toBe(404);
    expect(await (await get('/project/abc')).text()).toBe('<html>editor</html>');
    expect((await get('/_app/missing.js')).status).toBe(404);

    const forged = await editor.fetch(
      new Request(`${ORIGIN}/rpc/session.info`, {
        method: 'POST',
        body: 'null',
        headers: { origin: 'https://evil.example' },
      }),
    );
    expect(forged!.status).toBe(403);
  });

  it('serves project files and downloads folders as zip', async () => {
    const { id } = await client.api(ProjectsContract).open({ path: 'pong' });
    const fetchFile = async (path: string) => {
      const response = await editor.fetch(
        new Request(`${ORIGIN}/files/${id}/${path}`, { headers: { cookie: '' } }),
      );
      return response!;
    };
    const file = await fetchFile('apps/client/package.json');
    expect(file.status).toBe(200);
    expect(await file.json()).toMatchObject({ name: expect.any(String) });

    const download = await fetchFile('apps/client/package.json?download');
    expect(download.headers.get('content-disposition')).toBe('attachment; filename="package.json"');

    const archive = await fetchFile('apps?download');
    expect(archive.headers.get('content-type')).toBe('application/zip');
    const bytes = new Uint8Array(await archive.arrayBuffer());
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK');

    expect((await fetchFile('..%2Foutside')).status).toBe(404);
  });
});
