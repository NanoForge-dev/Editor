import type { z } from 'zod';

import {
  type CodeDiagnostic,
  DiagnosticsServiceToken,
  DocumentServiceToken,
} from '@nanoforge-dev/editor-code';
import {
  type Container,
  CoreServices,
  type Disposable,
  DisposableStore,
  type LoggerService,
  MutableDisposable,
  derived,
  observe,
} from '@nanoforge-dev/editor-kernel';
import type { ProjectService } from '@nanoforge-dev/editor-project';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';
import {
  type PlayMode,
  RuntimeService,
  RuntimeServiceToken,
  RuntimeSettings,
  isPlaying,
} from '@nanoforge-dev/editor-runtime';
import type { SettingsService } from '@nanoforge-dev/editor-settings';
import {
  KEYBINDINGS,
  MENU_BAR,
  MENU_ITEMS,
  MenuItemSchema,
  type NotificationService,
  STATUS_BAR_ITEMS,
  TOOLBAR_ITEMS,
} from '@nanoforge-dev/editor-ui';

import { WorkspaceActionsToken } from '../workspace/workspace-actions';
import { LOG_LEVELS, TOOLBAR } from './runtime-toolbar.const';

/**
 * The game runtime of the open project: play controls (commands, toolbar, Run menu,
 * shortcuts), context keys (`runtime.state`, `runtime.active`, `runtime.controllable`), game,
 * build and task output for the console, and build errors as problems.
 */
export const followProjectRuntime = (options: {
  services: Container;
  projects: ProjectService;
  rpc: RpcClient;
  settings: SettingsService;
  logs: LoggerService;
  notifications: NotificationService;
  /** Local editors only: hosted editors never run project code. */
  enabled: boolean;
}): Disposable => {
  const { services, settings, logs } = options;
  const store = new DisposableStore();
  const commands = services.get(CoreServices.Commands);
  const contextKeys = services.get(CoreServices.ContextKeys);
  const extensions = services.get(CoreServices.Extensions);
  const current = store.add(new MutableDisposable<DisposableStore>());
  let runtime: RuntimeService | undefined;

  const setKeys = (state: string, controllable: boolean) => {
    contextKeys.set('runtime.state', state);
    contextKeys.set('runtime.active', isPlaying(state as never));
    contextKeys.set('runtime.controllable', controllable);
  };
  setKeys('idle', false);

  if (options.enabled) {
    store.add({
      dispose: options.projects.current.subscribe((project) => {
        runtime = undefined;
        current.clear();
        setKeys('idle', false);
        if (!project) return;
        const scope = new DisposableStore();
        const service = scope.add(
          new RuntimeService({
            projectId: project.id,
            rpc: options.rpc,
            apps: () => project.model.get().apps,
            logger: logs.getLogger('runtime'),
            playMode: () => settings.get(RuntimeSettings.playMode),
            selectedApp: (type) =>
              settings.get(
                type === 'client' ? RuntimeSettings.clientApp : RuntimeSettings.serverApp,
              ) || undefined,
            envOverrides: () => settings.get(RuntimeSettings.env),
          }),
        );
        scope.add(services.provide(RuntimeServiceToken, service));
        const choices = scope.add(new DisposableStore());
        const refreshChoices = () => {
          choices.clear();
          for (const [type, title] of [
            ['client', 'Client app'],
            ['server', 'Server app'],
          ] as const) {
            const apps = service.playable(type);
            if (apps.length < 2) continue;
            const add = (item: z.input<typeof MenuItemSchema>) =>
              choices.add(
                extensions.contribute(MENU_ITEMS, MenuItemSchema.parse(item), { owner: 'core' }),
              );
            const current = service.appFor(type);
            add({ menu: 'run', submenu: `run.${type}`, title, group: 'apps', order: 0 });
            for (const app of apps) {
              add({
                menu: `run.${type}`,
                command: 'runtime.selectApp',
                args: [type, app.id],
                title: app.name,
                ...(app === current && { icon: 'check' }),
              });
            }
          }
        };
        scope.add({ dispose: project.model.subscribe(refreshChoices) });
        scope.add(observe(settings.observe(RuntimeSettings.clientApp), refreshChoices));
        scope.add(observe(settings.observe(RuntimeSettings.serverApp), refreshChoices));
        scope.add({
          dispose: service.session.subscribe(({ state, controllable }) =>
            setKeys(state, controllable),
          ),
        });
        scope.add(
          service.onLog(({ source, app, level, text, values, location }) =>
            logs.write({
              level: LOG_LEVELS[level],
              source:
                source === 'build'
                  ? `build:${app}`
                  : source === 'cli'
                    ? `cli:${app}`
                    : `game:${source}`,
              message: text,
              args: [],
              time: Date.now(),
              ...(values && { values }),
              ...(location && { location }),
            }),
          ),
        );
        const diagnostics = services.tryGet(DiagnosticsServiceToken);
        if (diagnostics) {
          const reported = new Set<string>();
          scope.add({
            dispose: service.builds.subscribe((builds) => {
              for (const [app, status] of builds) {
                if (status.state === 'building') continue;
                const source = `build:${app}`;
                reported.add(source);
                diagnostics.clear(source);
                const files = new Map<string, CodeDiagnostic[]>();
                for (const diagnostic of status.diagnostics) {
                  const path = diagnostic.path ?? '';
                  files.set(path, [
                    ...(files.get(path) ?? []),
                    {
                      path,
                      start: -1,
                      length: 0,
                      ...(diagnostic.line !== undefined && { line: diagnostic.line }),
                      ...(diagnostic.column !== undefined && { column: diagnostic.column }),
                      message: diagnostic.message,
                      severity: diagnostic.severity,
                      source,
                    },
                  ]);
                }
                for (const [path, list] of files) diagnostics.set(source, path, list);
              }
            }),
          });
          scope.add({
            dispose: () => {
              for (const source of reported) diagnostics.clear(source);
            },
          });
        }
        const notified = new Set<string>();
        scope.add({
          dispose: service.session.subscribe(({ state, compatibility }) => {
            if (state !== 'running') return;
            for (const check of compatibility) {
              const key = `${check.source}:${check.status}`;
              if (!check.message || notified.has(key)) continue;
              notified.add(key);
              const app =
                check.status === 'legacy'
                  ? project.model.get().apps.find((candidate) => candidate.id === check.app)
                  : undefined;
              const workspace = services.tryGet(WorkspaceActionsToken);
              options.notifications.notify(
                'warning',
                check.status === 'legacy'
                  ? 'The game has no editor bridge'
                  : 'The game engine needs an update',
                {
                  detail: check.message,
                  ...(app &&
                    workspace && {
                      actions: [
                        {
                          title: 'Add the editor library',
                          run: () => void workspace.addEditorLibrary(app),
                        },
                      ],
                      timeout: 0,
                    }),
                },
              );
            }
          }),
        });
        scope.add(
          extensions.contribute(
            STATUS_BAR_ITEMS,
            {
              id: 'runtime.frameStats',
              alignment: 'right',
              order: 0,
              when: 'runtime.active',
              tooltip: 'Ticks per second and average tick duration of the running games',
              text: derived([service.frameStats], (stats) =>
                [...stats]
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(
                    ([source, { tps, tick }]) =>
                      `${source} ${Math.round(tps)} tps · ${tick.avg.toFixed(1)} ms`,
                  )
                  .join('   '),
              ),
            },
            { owner: 'core' },
          ),
        );
        runtime = service;
        current.value = scope;
      }),
    });
  }

  const withRuntime =
    (run: (runtime: RuntimeService, ...args: unknown[]) => unknown) =>
    (_services: unknown, ...args: unknown[]) => {
      if (!runtime) {
        options.notifications.notify('info', 'Games can only be run from a local editor');
        return;
      }
      return run(runtime, ...args);
    };

  const play = async (target: RuntimeService, mode?: PlayMode) => {
    const resolved = mode ?? target.defaultMode();
    const documents = services.tryGet(DocumentServiceToken);
    if (documents && settings.get(RuntimeSettings.saveBeforePlay)) {
      const failed = await documents.saveAll();
      if (failed.length) {
        options.notifications.notify('error', `Could not save ${failed[0]!.uri} before playing`, {
          detail: String(failed[0]!.error),
        });
        return;
      }
    }
    await target.play(resolved);
    const session = target.session.get();
    if (session.state === 'crashed') {
      const first = session.diagnostics?.[0];
      options.notifications.notify('error', session.error ?? 'The game crashed', {
        ...(first && {
          detail:
            `${first.path ?? ''}${first.line ? `:${first.line}` : ''} ${first.message}`.trim(),
        }),
      });
    }
  };

  store.add(
    commands.register({
      id: 'runtime.selectApp',
      title: 'Choose the app Play starts',
      category: 'Run',
      palette: false,
      handler: async (_services, type: unknown, app: unknown) => {
        if ((type !== 'client' && type !== 'server') || typeof app !== 'string') return;
        await settings.set(
          type === 'client' ? RuntimeSettings.clientApp : RuntimeSettings.serverApp,
          app,
          settings.hasStore('projectLocal') ? 'projectLocal' : 'project',
        );
      },
    }),
  );

  for (const [id, title, handler] of [
    ['runtime.play', 'Play', withRuntime((target, mode) => play(target, mode as PlayMode))],
    ['runtime.playClient', 'Play client only', withRuntime((target) => play(target, 'client'))],
    ['runtime.playServer', 'Play server only', withRuntime((target) => play(target, 'server'))],
    ['runtime.pause', 'Pause', withRuntime((target) => target.pause())],
    ['runtime.resume', 'Resume', withRuntime((target) => target.resume())],
    ['runtime.step', 'Step one frame', withRuntime((target) => target.step())],
    ['runtime.stop', 'Stop', withRuntime((target) => target.stop())],
    ['runtime.restart', 'Restart', withRuntime((target) => target.restart())],
    [
      'runtime.reload',
      'Reload editor runtime',
      withRuntime(async (target) => {
        await target.stop();
        location.reload();
      }),
    ],
    [
      'runtime.openClient',
      'Open another client',
      withRuntime(() => {
        const project = options.projects.current.get();
        const app = runtime?.appFor('client');
        if (!project || !app) return;
        const url = new URL(`/play/${project.id}`, location.origin);
        url.searchParams.set('app', app.id);
        const env = settings.get(RuntimeSettings.env);
        if (Object.keys(env).length) url.hash = `env=${btoa(JSON.stringify(env))}`;
        window.open(url, '_blank', 'noopener');
      }),
    ],
  ] as const) {
    store.add(commands.register({ id, title, category: 'Run', handler }));
  }

  for (const item of TOOLBAR)
    store.add(extensions.contribute(TOOLBAR_ITEMS, item, { owner: 'core' }));
  store.add(
    extensions.contribute(MENU_BAR, { id: 'run', title: 'Run', order: 3 }, { owner: 'core' }),
  );
  for (const item of [
    { menu: 'run', command: 'runtime.play', group: 'play', order: 0, when: '!runtime.active' },
    {
      menu: 'run',
      command: 'runtime.playClient',
      group: 'play',
      order: 1,
      when: '!runtime.active',
    },
    {
      menu: 'run',
      command: 'runtime.playServer',
      group: 'play',
      order: 2,
      when: '!runtime.active',
    },
    {
      menu: 'run',
      command: 'runtime.pause',
      group: 'control',
      order: 0,
      when: "runtime.state == 'running' && runtime.controllable",
    },
    {
      menu: 'run',
      command: 'runtime.resume',
      group: 'control',
      order: 1,
      when: "runtime.state == 'paused'",
    },
    {
      menu: 'run',
      command: 'runtime.step',
      group: 'control',
      order: 2,
      when: "runtime.state == 'paused'",
    },
    { menu: 'run', command: 'runtime.restart', group: 'control', order: 3, when: 'runtime.active' },
    { menu: 'run', command: 'runtime.stop', group: 'control', order: 4, when: 'runtime.active' },
    { menu: 'run', command: 'runtime.openClient', group: 'z-clients' },
    { menu: 'run', command: 'runtime.reload', group: 'z-reload' },
  ]) {
    store.add(extensions.contribute(MENU_ITEMS, MenuItemSchema.parse(item), { owner: 'core' }));
  }
  for (const binding of [
    { key: 'F5', command: 'runtime.play', when: '!runtime.active', args: [] },
    { key: 'F5', command: 'runtime.resume', when: "runtime.state == 'paused'", args: [] },
    { key: 'Shift+F5', command: 'runtime.stop', when: 'runtime.active', args: [] },
    { key: 'Mod+Shift+F5', command: 'runtime.restart', when: 'runtime.active', args: [] },
  ]) {
    store.add(extensions.contribute(KEYBINDINGS, binding, { owner: 'core' }));
  }

  return store;
};
