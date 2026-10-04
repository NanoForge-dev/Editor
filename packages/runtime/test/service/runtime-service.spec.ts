import { chmodSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoggerService } from '@nanoforge-dev/editor-kernel';
import { type ProjectModel, ProjectsContract } from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';
import { type EditorServer, createEditorServer, loadEnv } from '@nanoforge-dev/editor-server-core';
import { TEST_ORIGIN, createLoopbackClient } from '@nanoforge-dev/editor-server-core/testing';

import type { GameClientModule } from '../../src/client/game-client-runner.type';
import { RuntimeService } from '../../src/service/runtime-service';
import type { GameEvent, PlaySession, RuntimeLog } from '../../src/service/runtime-service.type';

const SERVER_CORE_TEST = join(import.meta.dirname, '../../../server-core/test');
const GAME = join(SERVER_CORE_TEST, 'fixtures/runtime/bridge-game.js');

/** A view as the Game screen gives it (with a minimal DOM). */
const fakeHost = () => {
  interface FakeElement {
    dataset: Record<string, string>;
    style: object;
    children: FakeElement[];
    removed: boolean;
    ownerDocument: typeof document;
    append(child: FakeElement): void;
    remove(): void;
  }
  const created: FakeElement[] = [];
  const document = {
    createElement: (): FakeElement => {
      const element: FakeElement = {
        dataset: {},
        style: {},
        children: [],
        removed: false,
        ownerDocument: document,
        append: (child) => {
          child.removed = false;
          element.children.push(child);
        },
        remove: () => (element.removed = true),
      };
      created.push(element);
      return element;
    },
  };
  const host = document.createElement();
  /** Game containers created by the runs (the stage holds them). */
  const mounts = () => created.filter((element) => 'nfGame' in element.dataset);
  return { host, mounts };
};

let workspace: string;
let editor: EditorServer;
let client: RpcClient;
let model: ProjectModel;
const imported: { url: string; options: Parameters<GameClientModule['main']>[0] }[] = [];

/** Loads the served bundle like a browser would (fresh module instance per run). */
const importModule = async (url: string): Promise<GameClientModule> => {
  const response = (await editor.fetch(new Request(url)))!;
  if (response.status !== 200) throw new Error(`GET ${url}: ${response.status}`);
  const source = `${await response.text()}\n// ${url}`;
  const module = (await import(
    `data:text/javascript,${encodeURIComponent(source)}`
  )) as GameClientModule;
  return {
    main: (options) => {
      imported.push({ url, options });
      return module.main(options);
    },
  };
};

const createService = (overrides: Partial<ConstructorParameters<typeof RuntimeService>[0]> = {}) =>
  new RuntimeService({
    projectId: model.id,
    rpc: client,
    apps: () => model.apps,
    logger: new LoggerService().getLogger('runtime'),
    importModule,
    origin: TEST_ORIGIN,
    ...overrides,
  });

const until = async (service: RuntimeService, state: PlaySession['state']) => {
  for (const start = Date.now(); service.session.get().state !== state;) {
    if (Date.now() - start > 10_000) {
      throw new Error(`Still ${service.session.get().state}, expected ${state}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

beforeAll(async () => {
  workspace = mkdtempSync(join(SERVER_CORE_TEST, '.tmp-play-'));
  const root = join(workspace, 'pong');
  cpSync(join(SERVER_CORE_TEST, 'fixtures/pong-network'), root, { recursive: true });
  cpSync(GAME, join(root, 'apps/client/game.js'));
  cpSync(GAME, join(root, 'apps/server/game.js'));
  writeFileSync(join(root, '.env'), 'NANOFORGE_CLIENT_PORT=1\nNANOFORGE_SERVER_PORT=2\n');
  const cli = join(workspace, 'nf.cjs');
  cpSync(join(SERVER_CORE_TEST, 'fixtures/runtime/nf.cjs'), cli);
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
  const { id } = await client.api(ProjectsContract).open({ path: 'pong' });
  model = await client.api(ProjectsContract).model({ id });
});

afterAll(() => {
  client.dispose();
  editor.dispose();
  rmSync(workspace, { recursive: true, force: true });
});

describe('RuntimeService', () => {
  it('plays server and client, pauses, steps and stops them, three times', async () => {
    const service = createService();
    const { host, mounts } = fakeHost();
    service.attach(host as unknown as HTMLElement);
    const events: GameEvent[] = [];
    service.onEvent((event) => events.push(event));
    const logs: RuntimeLog[] = [];
    service.onLog((log) => logs.push(log));
    const states: string[] = [];
    service.session.subscribe((session) => {
      if (states.at(-1) !== session.state) states.push(session.state);
    });

    expect(service.defaultMode()).toBe('server+client');
    for (let run = 1; run <= 3; run++) {
      imported.length = 0;
      await service.play();
      expect(service.session.get().error).toBeUndefined();
      expect(service.session.get()).toMatchObject({
        state: 'running',
        mode: 'server+client',
        apps: ['apps/server', 'apps/client'],
        controllable: true,
      });
      const { url, options } = imported[0]!;
      expect(url).toMatch(new RegExp(`/runtime/${model.id}/apps%2Fclient/main\\.js\\?v=\\w+&run=`));
      expect(options.env).toEqual({ PORT: '1' });
      expect(options.files.get('/data.txt')).toMatch(
        /^http:\/\/editor\.test\/runtime\/.+data\.txt\?v=\w+$/,
      );
      expect(mounts()).toHaveLength(run);
      expect(mounts()[run - 1]!.dataset.nfGame).toBe('apps/client');

      service.pause();
      await until(service, 'paused');
      service.step();
      await expect
        .poll(() => events.filter((event) => event.event === 'stepped').map((e) => e.source))
        .toEqual(expect.arrayContaining(['client', 'server']));
      events.length = 0;
      service.resume();
      await until(service, 'running');

      expect(service.session.get().compatibility.map((check) => check.status)).toEqual([
        'ok',
        'ok',
      ]);
      await expect
        .poll(() => [...service.frameStats.get().keys()].sort())
        .toEqual(['client', 'server']);
      await expect
        .poll(() => logs.filter((log) => log.source === 'client' && log.text === 'from the game'))
        .toHaveLength(run);

      await service.stop();
      expect(service.session.get().state).toBe('idle');
      expect(mounts().at(-1)!.removed).toBe(true);
      expect(
        events.filter((event) => event.event === 'state' && event.args[0] === 'stopped'),
      ).toHaveLength(2);
      expect(
        await editor.runtime
          .get(editor.projects.get({ mode: 'OFFLINE' } as never, model.id))
          .servers(),
      ).toEqual([]);
    }
    expect(states.slice(0, 7)).toEqual([
      'idle',
      'building',
      'starting',
      'running',
      'paused',
      'running',
      'stopping',
    ]);
    service.dispose();
  });

  it('plays the chosen client and server of a project with several', () => {
    const second = (type: 'client' | 'server') => {
      const first = model.apps.find((app) => app.type === type)!;
      return { ...first, id: `apps/${type}-2`, root: `apps/${type}-2`, name: `${type}-2` };
    };
    const apps = [...model.apps, second('client'), second('server')];
    let chosen: Record<string, string | undefined> = {};
    const service = createService({ apps: () => apps, selectedApp: (type) => chosen[type] });
    expect(service.playable('client').map((app) => app.id)).toEqual([
      'apps/client',
      'apps/client-2',
    ]);
    expect(service.appFor('client')?.id).toBe('apps/client');
    expect(service.appFor('server')?.id).toBe('apps/server');
    chosen = { client: 'apps/client-2', server: 'apps/server-2' };
    expect(service.appFor('client')?.id).toBe('apps/client-2');
    expect(service.appFor('server')?.id).toBe('apps/server-2');
    chosen = { client: 'apps/gone' };
    expect(service.appFor('client')?.id).toBe('apps/client');
    service.dispose();
  });

  it('moves the game stage between Game views', () => {
    const service = createService();
    const first = fakeHost().host;
    const view = service.attach(first as unknown as HTMLElement);
    const stage = first.children[0]!;
    view.dispose();
    expect(stage.removed).toBe(true);
    expect(service.host.get()).toBeUndefined();

    const second = fakeHost().host;
    service.attach(second as unknown as HTMLElement);
    expect(second.children).toEqual([stage]);
    expect(stage.removed).toBe(false);
    service.dispose();
  });

  it('plays games whose engine does not speak the bridge, without pause', async () => {
    const legacy = join(SERVER_CORE_TEST, 'fixtures/runtime/legacy-game.js');
    for (const app of ['client', 'server']) {
      cpSync(legacy, join(workspace, `pong/apps/${app}/game.js`));
    }
    const service = createService({ serverStartTimeoutMs: 3000, helloTimeoutMs: 100 });
    const { mounts, host } = fakeHost();
    service.attach(host as unknown as HTMLElement);
    for (let run = 1; run <= 2; run++) {
      await service.play('server+client');
      expect(service.session.get().error).toBeUndefined();
      expect(service.session.get()).toMatchObject({ state: 'running', controllable: false });
      expect(service.session.get().compatibility).toEqual([
        expect.objectContaining({ source: 'server', status: 'legacy' }),
        expect.objectContaining({
          source: 'client',
          status: 'legacy',
          message: expect.stringContaining('Reload editor runtime'),
        }),
      ]);
      await service.stop();
      expect(service.session.get().state).toBe('idle');
      expect(mounts().at(-1)!.removed).toBe(true);
    }
    for (const app of ['client', 'server'])
      cpSync(GAME, join(workspace, `pong/apps/${app}/game.js`));
    service.dispose();
  });

  it('crashes with the build diagnostics when the game does not build', async () => {
    const file = join(workspace, 'pong/apps/client/game.js');
    writeFileSync(file, '// SYNTAX ERROR\n');
    const service = createService();
    service.attach(fakeHost().host as unknown as HTMLElement);
    await service.play('client');
    expect(service.session.get()).toMatchObject({
      state: 'crashed',
      error: 'The game has build errors',
      diagnostics: [{ path: 'apps/client/game.js', message: 'Unexpected ;' }],
    });
    await service.stop();
    expect(service.session.get().state).toBe('idle');
    cpSync(GAME, file);
    service.dispose();
  });

  it('crashes when the game server exits on its own', async () => {
    const service = createService({ envOverrides: () => ({ NANOFORGE_SERVER_CRASH: '1' }) });
    await service.play('server');
    await until(service, 'crashed');
    expect(service.session.get().error).toBe('The game server exited (code 3)');
    service.dispose();
  });
});
