import { chmodSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ProjectsContract,
  RuntimeContract,
  type RuntimeEvent,
  runtimeOutputPath,
} from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';

import { loadEnv } from '../../src/env/load-env';
import { parseBuildOutput } from '../../src/runtime/build-orchestrator';
import { parseDotenv, splitGameEnv } from '../../src/runtime/game-env';
import { createEditorServer } from '../../src/server/create-editor-server';
import type { EditorServer } from '../../src/server/editor-server.type';
import { TEST_ORIGIN, createLoopbackClient } from '../../src/testing';

const RUNTIME_FIXTURES = join(import.meta.dirname, '../fixtures/runtime');
const SERVER_GAME = readFileSync(join(RUNTIME_FIXTURES, 'bridge-game.js'), 'utf8');

let workspace: string;
let editor: EditorServer;
let client: RpcClient;
let project: string;
const events: RuntimeEvent[] = [];

const waitFor = async <T>(find: () => T | undefined, timeout = 10_000): Promise<T> => {
  const start = Date.now();
  for (;;) {
    const found = find();
    if (found !== undefined && found !== false) return found;
    if (Date.now() - start > timeout) throw new Error('Timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

beforeAll(async () => {
  workspace = mkdtempSync(join(import.meta.dirname, '../.tmp-runtime-'));
  const root = join(workspace, 'pong');
  cpSync(join(import.meta.dirname, '../fixtures/pong-network'), root, { recursive: true });
  writeFileSync(join(root, 'apps/client/game.js'), 'export const main = async () => {};\n');
  writeFileSync(join(root, 'apps/server/game.js'), SERVER_GAME);
  writeFileSync(
    join(root, '.env'),
    'NANOFORGE_SERVER_PORT=4444\nNANOFORGE_CLIENT_SERVER_PORT=4444\nNANOFORGE_SHARED="both"\n',
  );
  const cli = join(workspace, 'nf.cjs');
  cpSync(join(RUNTIME_FIXTURES, 'nf.cjs'), cli);
  chmodSync(cli, 0o755);

  editor = createEditorServer({
    env: loadEnv(
      {
        NODE_ENV: 'test',
        FS_ROOT: workspace,
        DATA_DIR: join(mkdtempSync(join(tmpdir(), 'nf-data-')), 'editor'),
        NF_CLI_PATH: cli,
      },
      workspace,
    ),
    version: '0.0.0-test',
  });
  client = createLoopbackClient(editor);
  project = (await client.api(ProjectsContract).open({ path: 'pong' })).id;
  client.subscribe(RuntimeContract, 'events', { project }, (event) => events.push(event));
});

afterAll(() => {
  client.dispose();
  editor.dispose();
  rmSync(workspace, { recursive: true, force: true });
});

describe('game env', () => {
  it('parses .env files', () => {
    expect(
      parseDotenv('# comment\nA=1\nexport B = "two words"\nC=\'x#y\'\nD=3 # trailing\nbad line'),
    ).toEqual({ A: '1', B: 'two words', C: 'x#y', D: '3' });
  });

  it('splits client and server variables like nf start', () => {
    expect(
      splitGameEnv({
        NANOFORGE_CLIENT_PORT: '1',
        NANOFORGE_SERVER_PORT: '2',
        NANOFORGE_NAME: 'pong',
        NANOFORGE_EMPTY: '',
        PATH: '/bin',
      }),
    ).toEqual({ client: { PORT: '1', NAME: 'pong' }, server: { PORT: '2', NAME: 'pong' } });
  });
});

describe('build output parsing', () => {
  it('reads bun errors with their location', () => {
    const output =
      '\x1b[31merror: Unexpected ;\x1b[39m\n    at /game/apps/client/src/main.ts:110:11\n';
    expect(parseBuildOutput(output, '/game')).toEqual([
      {
        message: 'Unexpected ;',
        severity: 'error',
        path: 'apps/client/src/main.ts',
        line: 110,
        column: 11,
      },
    ]);
  });
});

describe('runtime', () => {
  const runtime = () => client.api(RuntimeContract);

  it('builds every app and serves their output with content hashes', async () => {
    const statuses = await runtime().build({ project });
    expect(statuses.map((status) => [status.app, status.state])).toEqual([
      ['apps/client', 'ok'],
      ['apps/server', 'ok'],
    ]);
    expect(statuses[0]!.version).toMatch(/^[0-9a-f]{16}$/);

    const manifest = await runtime().manifest({ project, app: 'apps/client' });
    expect(manifest).toMatchObject({
      entry: 'main.js',
      baseUrl: runtimeOutputPath(project, 'apps/client'),
      version: statuses[0]!.version,
    });
    expect(manifest.files.map((file) => file.path)).toEqual(['data.txt', 'main.js']);

    const response = (await editor.fetch(
      new Request(`${TEST_ORIGIN}${manifest.baseUrl}main.js?v=${manifest.files[1]!.hash}`),
    ))!;
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('immutable');
    expect(await response.text()).toContain('export const main');
    const stale = (await editor.fetch(
      new Request(`${TEST_ORIGIN}${manifest.baseUrl}main.js?v=0000`),
    ))!;
    expect(stale.headers.get('cache-control')).toBe('no-store');
    const escape = await editor.fetch(
      new Request(`${TEST_ORIGIN}${manifest.baseUrl}..%2F..%2Fpackage.json`),
    );
    expect(escape?.status).toBe(404);
  });

  it('streams other CLI runs of the project as tasks, and never builds', async () => {
    const before = events.length;
    const run = editor.cli.run(['build', '--editor', '--directory', 'apps/client'], {
      cwd: join(workspace, 'pong'),
    });
    await run.done;
    const lines = await waitFor(() => {
      const logs = events.slice(before).filter((event) => event.type === 'log');
      return logs.some((log) => log.text === 'Build succeeded!') ? logs : undefined;
    });
    expect(lines.map((log) => [log.source, log.app, log.text])).toEqual([
      [
        'cli',
        'nf build --editor --directory apps/client',
        '$ nf build --editor --directory apps/client',
      ],
      ['cli', 'nf build --editor --directory apps/client', 'Build succeeded!'],
    ]);
    const count = events.length;
    await editor.cli.run(['build', '--editor', '--directory', 'pong/apps/client'], {
      cwd: workspace,
    }).done;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(events.slice(count).filter((event) => event.type === 'log')).toEqual([]);
  });

  it('reports build errors as diagnostics', async () => {
    const file = join(workspace, 'pong/apps/client/game.js');
    writeFileSync(file, 'export const main = 1;\n// SYNTAX ERROR\n');
    const [status] = await runtime().build({ project, apps: ['apps/client'] });
    expect(status).toMatchObject({ state: 'error' });
    expect(status!.diagnostics[0]).toMatchObject({
      path: 'apps/client/game.js',
      line: 3,
      message: 'Unexpected ;',
    });
    expect(events.some((event) => event.type === 'log' && event.text === 'Build failed!')).toBe(
      true,
    );
    writeFileSync(file, 'export const main = async () => {};\n');
  });

  it('rebuilds only the changed app while subscribed', async () => {
    await runtime().build({ project });
    for (let count = -1; count !== events.length;) {
      count = events.length;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    events.length = 0;
    writeFileSync(join(workspace, 'pong/apps/server/game.js'), `${SERVER_GAME}// changed\n`);
    await waitFor(() =>
      events.find((event) => event.type === 'build' && event.status.state === 'ok'),
    );
    const built = events.flatMap((event) => (event.type === 'build' ? [event.status.app] : []));
    expect(new Set(built)).toEqual(new Set(['apps/server']));
  });

  it('splits the env of each side, with overrides', async () => {
    expect(await runtime().env({ project, app: 'apps/client' })).toEqual({
      SERVER_PORT: '4444',
      SHARED: 'both',
    });
    expect(
      await runtime().env({
        project,
        app: 'apps/server',
        overrides: { NANOFORGE_SERVER_PORT: '5555' },
      }),
    ).toEqual({ PORT: '5555', SHARED: 'both' });
  });

  it('runs, pauses and stops the game server, three times in a row', async () => {
    for (let run = 0; run < 3; run++) {
      events.length = 0;
      await runtime().startServer({ project, app: 'apps/server', overrides: {} });
      await waitFor(() =>
        events.find((event) => event.type === 'server' && event.state === 'running'),
      );
      expect(
        events.find((event) => event.type === 'log' && event.text.startsWith('port=')),
      ).toMatchObject({ source: 'server', text: 'port=4444 files=/data.txt,/main.js' });

      await runtime().sendServer({ project, app: 'apps/server', event: 'pause', args: [] });
      await waitFor(() =>
        events.find((event) => event.type === 'server' && event.state === 'paused'),
      );
      await runtime().sendServer({ project, app: 'apps/server', event: 'ping', args: [run] });
      await waitFor(() =>
        events.find((event) => event.type === 'bridge' && event.event === 'pong'),
      );

      await runtime().stopServer({ project, app: 'apps/server' });
      expect(events.at(-1)).toMatchObject({ type: 'server', state: 'exited', exitCode: 0 });
      expect((await runtime().status({ project })).servers).toEqual([]);
    }
  });

  it('kills a game server that ignores stop', async () => {
    writeFileSync(
      join(workspace, 'pong/apps/server/game.js'),
      'export const main = async () => { setInterval(() => {}, 1000); };\n',
    );
    await runtime().build({ project, apps: ['apps/server'] });
    const server = editor.runtime.get(editor.projects.get({ mode: 'OFFLINE' } as never, project));
    events.length = 0;
    await server.startServer('apps/server');
    await waitFor(() => events.find((event) => event.type === 'log' || event.type === 'server'));
    const started = Date.now();
    await server.stopServer('apps/server');
    expect(Date.now() - started).toBeLessThan(3000);
    expect(events.at(-1)).toMatchObject({ type: 'server', state: 'exited' });
  });
});
