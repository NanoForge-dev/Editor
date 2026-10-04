import { version as svelteVersion } from 'svelte/package.json';

import {
  HistoryService,
  HistoryServiceToken,
  registerHistoryCommands,
} from '@nanoforge-dev/editor-history';
import {
  type Container,
  CoreServices,
  type Disposable,
  DisposableStore,
  LogLevel,
  type Logger,
  type Observable,
  PluginHost,
  PluginHostToken,
  consoleSink,
  createCoreContainer,
  switchObservable,
} from '@nanoforge-dev/editor-kernel';
import { ProjectService, ProjectServiceToken } from '@nanoforge-dev/editor-project';
import { PluginsContract, SessionContract, type SessionInfo } from '@nanoforge-dev/editor-protocol';
import { RpcClient, RpcClientToken } from '@nanoforge-dev/editor-rpc';
import { RuntimeSettings } from '@nanoforge-dev/editor-runtime';
import { version as sdkVersion } from '@nanoforge-dev/editor-sdk/package.json';
import {
  AccountSyncToken,
  CoreSettings,
  type SettingsService,
  followCurrentProject,
  settingsContributionHandler,
  setupSettings,
} from '@nanoforge-dev/editor-settings';
import {
  KeybindingServiceToken,
  LAYOUT_HISTORY_CONTEXT,
  NotificationServiceToken,
  PromptServiceToken,
  type Shell,
  StyleServiceToken,
  ThemeServiceToken,
  setupShell,
} from '@nanoforge-dev/editor-ui';

import { installSharedModules } from '$lib/plugin/shared-modules';
import { registerCorePanels } from '$lib/project/register-core-panels';

import { followProjectCode } from '../code/follow-project-code';
import { followProjectPlugins, toDescriptor } from '../plugin/follow-project-plugins';
import { followProjectRuntime } from '../runtime/follow-project-runtime';
import { WorkspaceActions, WorkspaceActionsToken } from '../workspace/workspace-actions';
import { registerAppContributions } from './register-app-contributions';

export interface Editor extends Disposable {
  readonly services: Container;
  readonly rpc: RpcClient;
  readonly plugins: PluginHost;
  readonly projects: ProjectService;
  readonly settings: SettingsService;
  readonly history: HistoryService;
  readonly shell: Shell;
  /** Id of the project whose settings scopes are attached. */
  readonly projectSettings: Observable<string | undefined>;
  readonly session: SessionInfo;
  readonly logger: Logger;
}

/**
 * Boots the editor in the browser: shared modules for plugins, the kernel container with the
 * core client services, then the plugin host.
 */
export const createEditor = async (
  onProgress: (step: string, done: number, total: number, description?: string) => void = () =>
    undefined,
): Promise<Editor> => {
  const TOTAL = 4;
  onProgress(
    'Connecting to the editor server',
    0,
    TOTAL,
    'Checking your session with the editor server.',
  );
  installSharedModules();
  const store = new DisposableStore();
  const services = store.add(createCoreContainer());
  const logs = services.get(CoreServices.Logger);
  logs.level = LogLevel.Debug;
  store.add(logs.addSink((entry) => entry.level >= LogLevel.Info && consoleSink(entry)));
  const logger = logs.getLogger('editor');

  const rpc = store.add(new RpcClient({ baseUrl: location.origin }));
  const projects = store.add(new ProjectService(rpc));
  services.provide(RpcClientToken, rpc);
  services.provide(ProjectServiceToken, projects);
  services.provide(CoreServices.EngineLibs, {
    apps: switchObservable(
      {
        get: () => projects.current.get()?.apps,
        subscribe: (run) => projects.current.subscribe((project) => run(project?.apps)),
      },
      [],
    ),
  });

  const session = await rpc.api(SessionContract).info(null);
  onProgress(
    'Loading settings',
    1,
    TOTAL,
    session.mode === 'ONLINE'
      ? 'Reading your preferences and syncing your NanoForge account settings.'
      : 'Reading your editor preferences.',
  );
  const settingsSetup = store.add(
    await setupSettings({
      services,
      rpc,
      mode: session.mode,
      userId: session.user?.id ?? 'anonymous',
    }),
  );
  store.add(settingsSetup.registry.register(...Object.values(RuntimeSettings)));
  const projectSettings = store.add(followCurrentProject(settingsSetup, projects.current));
  const { settings } = settingsSetup;
  services.provide(AccountSyncToken, settingsSetup.account);

  const history = store.add(
    new HistoryService({
      limit: settings.observe(CoreSettings.historyLimit),
      mergeWindowMs: settings.observe(CoreSettings.historyMergeWindow),
      localOrigin: { kind: 'user', id: session.user?.id ?? 'anonymous' },
    }),
  );
  services.provide(HistoryServiceToken, history);
  store.add(
    registerHistoryCommands(
      services.get(CoreServices.Commands),
      services.get(CoreServices.ContextKeys),
      history,
      { fallbackContext: LAYOUT_HISTORY_CONTEXT },
    ),
  );

  onProgress('Loading plugins', 2, TOTAL, 'Finding built-in, installed and local plugins.');
  const listings = await rpc.api(PluginsContract).list(null);
  const plugins = store.add(
    new PluginHost({
      services,
      editorVersion: __EDITOR_VERSION__,
      runtimeVersions: { svelte: svelteVersion, sdk: sdkVersion },
      disabled: new Set(settings.get(CoreSettings.pluginsDisabled)),
    }),
  );
  store.add(
    plugins.registerContributionHandler(settingsContributionHandler(settingsSetup.registry)),
  );
  services.provide(PluginHostToken, plugins);

  const shell = store.add(
    setupShell({
      extensions: services.get(CoreServices.Extensions),
      commands: services.get(CoreServices.Commands),
      contextKeys: services.get(CoreServices.ContextKeys),
      settings,
      logger: logs.getLogger('ui'),
      plugins,
    }),
  );
  services.provide(NotificationServiceToken, shell.notifications);
  services.provide(PromptServiceToken, shell.prompts);
  services.provide(KeybindingServiceToken, shell.keybindings);
  services.provide(StyleServiceToken, shell.styles);
  services.provide(ThemeServiceToken, shell.themes);
  store.add(registerCorePanels(services.get(CoreServices.Extensions)));
  const code = store.add(
    followProjectCode({
      services,
      projects,
      rpc,
      plugins,
      notifications: shell.notifications,
      history,
      logger: logs.getLogger('editor'),
    }),
  );
  store.add(
    followProjectRuntime({
      services,
      projects,
      rpc,
      settings,
      logs,
      notifications: shell.notifications,
      enabled: session.mode === 'OFFLINE',
    }),
  );
  const workspace = store.add(
    new WorkspaceActions({
      services,
      projects,
      rpc,
      history,
      notifications: shell.notifications,
      prompts: shell.prompts,
      local: session.mode === 'OFFLINE',
    }),
  );
  services.provide(WorkspaceActionsToken, workspace);
  store.add(registerAppContributions(services, session));
  store.add(
    history.onDidInvalidate(({ contextId, reason }) => {
      if (reason === 'external-change') {
        shell.notifications.notify(
          'warning',
          `Undo history of ${history.get(contextId)?.label ?? contextId} was cleared`,
          {
            detail: 'The file changed outside of the editor.',
          },
        );
      }
    }),
  );

  onProgress(
    'Starting plugins',
    3,
    TOTAL,
    listings.length
      ? `Checking and activating ${listings.length} plugin${listings.length > 1 ? 's' : ''}.`
      : 'No plugin to activate.',
  );
  await plugins.start(listings.flatMap((listing) => toDescriptor(listing, logger) ?? []));

  store.add(
    followProjectPlugins({ rpc, projects, plugins, notifications: shell.notifications, logger }),
  );

  store.add(
    rpc.subscribe(PluginsContract, 'devChanges', null, ({ name, listing }) => {
      const descriptor = toDescriptor(listing, logger);
      if (descriptor?.manifest.entry.worker) {
        code.reloadWorkerPlugin(
          name,
          new URL(descriptor.manifest.entry.worker, descriptor.baseUrl).href,
        );
      }
      if (descriptor)
        plugins
          .reload(name, descriptor)
          .catch((error: unknown) => logger.error(`Reload of ${name} failed`, error));
    }),
  );

  return {
    services,
    rpc,
    plugins,
    projects,
    settings,
    history,
    shell,
    projectSettings: projectSettings.attached,
    session,
    logger,
    dispose: () => store.dispose(),
  };
};
