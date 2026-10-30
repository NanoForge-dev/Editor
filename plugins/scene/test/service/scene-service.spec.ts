import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CodeServiceToken,
  DocumentServiceToken,
  ObservableValue,
  ProjectServiceToken,
} from '@nanoforge-dev/editor-sdk';

import type { AppScenesModel, SceneModel } from '../../src/model/scene-model.type';
import { SceneService } from '../../src/service/scene-service';

const { NOTIFICATIONS } = vi.hoisted(() => ({ NOTIFICATIONS: { id: 'notifications' } }));
vi.mock('@nanoforge-dev/editor-sdk/ui', () => ({ NotificationServiceToken: NOTIFICATIONS }));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const scene = (className: string, parent?: string): SceneModel =>
  ({
    id: className,
    className,
    path: `apps/client/src/scenes/${className.toLowerCase()}.ts`,
    line: 3,
    ...(parent && { parent }),
    ecs: true,
    ownSetup: true,
  }) as SceneModel;

const CLIENT = {
  id: 'client',
  name: 'client',
  type: 'client',
  root: 'apps/client',
  entryFile: 'apps/client/src/main.ts',
  engineLibs: { '@nanoforge-dev/scene': '*' },
  dirs: { scenes: 'apps/client/src/scenes' },
};
const SERVER = { ...CLIENT, id: 'server', name: 'server', type: 'server', root: 'apps/server' };
const PLAIN = { ...CLIENT, id: 'plain', engineLibs: {} };

const SCENES: AppScenesModel = {
  scenes: [scene('Menu'), scene('Game'), scene('Pause', 'Game')],
  library: { hasScenes: true } as never,
  problems: [],
};

const setup = ({ analyze }: { analyze?: (analyzer: string) => Promise<unknown> } = {}) => {
  const files = new Map<string, string>([['apps/client/src/scenes/menu.ts', '']]);
  const projectModel = new ObservableValue({ apps: [PLAIN, SERVER, CLIENT] } as never);
  const project = {
    model: projectModel,
    fs: {
      entry: (path: string) => (files.has(path) ? { path, kind: 'file' } : undefined),
      write: vi.fn(async (path: string, text: string) => void files.set(path, text)),
      delete: vi.fn(async (path: string) => void files.delete(path)),
      onDidChange: () => ({ dispose: () => undefined }),
    },
  };
  const edit = vi.fn(async (path: string, transformer: string, op: unknown) => ({
    label: transformer,
    do: async () => void files.set(path, JSON.stringify(op)),
    undo: async () => undefined,
  }));
  const code = {
    analyze: vi.fn(async (_path: string, analyzer: string) =>
      analyze ? analyze(analyzer) : analyzer.includes('vars') ? { vars: [] } : SCENES,
    ),
    edit,
  };
  const documents = { onDidChange: () => ({ dispose: () => undefined }), save: vi.fn() };
  const notify = vi.fn();
  const services = new Map<unknown, unknown>([
    [ProjectServiceToken, { current: new ObservableValue(project) }],
    [CodeServiceToken, code],
    [DocumentServiceToken, documents],
    [NOTIFICATIONS, { notify }],
  ]);
  const keys = new Map<string, unknown>();
  const executeCommand = vi.fn(async () => undefined);
  const context = {
    name: '@nanoforge/scene',
    services: {
      get: (token: unknown) => services.get(token),
      tryGet: (token: unknown) => services.get(token),
    },
    scope: { observe: () => new ObservableValue(code) },
    contextKeys: {
      get: (key: string) => keys.get(key),
      onDidChange: () => ({ dispose: () => undefined }),
    },
    logger: { warn: vi.fn() },
    executeCommand,
  };
  const service = new SceneService(context as never);
  return { service, code, files, notify, executeCommand, context };
};

afterEach(() => vi.useRealTimers());

describe('SceneService', () => {
  it('reads the scenes of the client app that has the scene library', async () => {
    const { service, code } = setup();
    await flush();
    await flush();
    expect(service.apps.map((app) => app.id)).toEqual(['server', 'client']);
    expect(service.appId.get()).toBe('client');
    expect(service.model.get()?.scenes.map((model) => model.id)).toEqual(['Menu', 'Game', 'Pause']);
    expect(service.vars.get()).toEqual({ vars: [] });
    expect(code.analyze).toHaveBeenCalledWith('apps/client/src/main.ts', expect.any(String), {
      root: 'apps/client',
    });
    service.dispose();
  });

  it("edits main until a scene is selected, then its setup under its parents' read-only ones", async () => {
    const { service } = setup();
    await flush();
    await flush();
    const app = service.app!;
    const current = service.current(app);
    const seen: unknown[] = [];
    const stop = current.subscribe((value) => seen.push(value));
    expect(current.get()).toEqual({ path: 'apps/client/src/main.ts', label: 'main.ts' });
    service.select('Pause');
    expect(current.get()).toMatchObject({
      path: 'apps/client/src/scenes/pause.ts',
      scope: { kind: 'method', class: 'Pause', method: 'setup' },
    });
    expect(
      service
        .inherited(app)
        .get()
        .map((location) => location.label),
    ).toEqual(['main.ts', 'Game']);
    service.select('Pause');
    expect(seen).toHaveLength(1);
    stop();
    expect(service.sceneLocation(app, 'Game')?.path).toBe('apps/client/src/scenes/game.ts');
    expect(service.sceneLocation(app, 'Nope')).toBeUndefined();
    service.select(undefined);
    expect(service.selectedScene(app)).toBeUndefined();
  });

  it('creates a scene file, adds it to the library, selects and opens it', async () => {
    const { service, files, code, executeCommand } = setup();
    await flush();
    await flush();
    expect(await service.newScene('Victory', SCENES.scenes[1])).toBe(true);
    expect(files.get('apps/client/src/scenes/victory.ts')).toContain('class Victory');
    expect(code.edit).toHaveBeenCalledWith(
      'apps/client/src/main.ts',
      expect.any(String),
      expect.objectContaining({ kind: 'addScene', className: 'Victory' }),
      { label: 'Scenes' },
    );
    expect(service.selected.get().get('client')).toBe('Victory');
    expect(executeCommand).toHaveBeenCalledWith(
      'codeEditor.open',
      'apps/client/src/scenes/victory.ts',
      { line: 11 },
    );
  });

  it('refuses a scene whose file exists, and a parent inside the scene', async () => {
    const { service, notify } = setup();
    await flush();
    await flush();
    expect(await service.newScene('Menu')).toBe(false);
    expect(notify).toHaveBeenCalledWith('warning', 'New scene Menu: not possible', {
      detail: 'apps/client/src/scenes/menu.ts already exists.',
    });
    const [, game, pause] = SCENES.scenes;
    expect(await service.setParent(game!, pause)).toBe(false);
    expect(notify).toHaveBeenLastCalledWith('warning', 'Move Game: not possible', {
      detail: 'Pause is inside Game.',
    });
    expect(await service.setParent(pause!, undefined)).toBe(true);
    expect(await service.setInitial(game!)).toBe(true);
  });

  it('waits for the worker to register its analyzers, then says what went wrong', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const { service, context } = setup({
      analyze: async () => {
        calls++;
        throw new Error(calls < 3 ? 'Unknown analyzer scenes' : 'Broken entry file');
      },
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toBe(3);
    expect(service.model.get()).toEqual({ scenes: [], problems: ['Broken entry file'] });
    expect(context.logger.warn).toHaveBeenCalled();
    service.dispose();
  });
});
