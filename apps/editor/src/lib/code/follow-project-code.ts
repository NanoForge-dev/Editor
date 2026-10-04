import { z } from 'zod';

import {
  CatalogService,
  CatalogServiceToken,
  CodeService,
  CodeServiceToken,
  DOCUMENT_EDITORS,
  DOCUMENT_EDITS,
  DiagnosticsService,
  DiagnosticsServiceToken,
  DocumentEditorSchema,
  DocumentService,
  DocumentServiceToken,
  createBrowserWorker,
  editorsFor,
  isCodeFile,
  projectFsBackend,
} from '@nanoforge-dev/editor-code';
import type { HistoryService } from '@nanoforge-dev/editor-history';
import {
  type Container,
  CoreServices,
  type Disposable,
  DisposableStore,
  type Logger,
  MutableDisposable,
  type PluginHost,
} from '@nanoforge-dev/editor-kernel';
import type { ProjectService } from '@nanoforge-dev/editor-project';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';
import { FILE_ACTIONS, type NotificationService } from '@nanoforge-dev/editor-ui';

import { indexedDbHistoryStore } from '../history/indexed-db-history-store';

export interface CodeServices extends Disposable {
  /** Reloads a plugin's worker entry (dev plugins rebuilt). */
  reloadWorkerPlugin(name: string, url: string): void;
}

/**
 * Documents, TypeScript services and diagnostics of the open project. They are recreated when
 * the project changes; the code worker starts on first use.
 */
export const followProjectCode = (options: {
  services: Container;
  projects: ProjectService;
  rpc: RpcClient;
  plugins: PluginHost;
  notifications: NotificationService;
  history: HistoryService;
  logger: Logger;
}): CodeServices => {
  const { services, logger } = options;
  const store = new DisposableStore();
  const diagnostics = new DiagnosticsService();
  store.add(services.provide(DiagnosticsServiceToken, diagnostics));
  const current = store.add(new MutableDisposable<DisposableStore>());
  let code: CodeService | undefined;

  const workerEntries = () =>
    options.plugins
      .getPlugins()
      .filter((plugin) => plugin.status.kind === 'ok' && plugin.descriptor.manifest.entry.worker)
      .map((plugin) => ({
        name: plugin.name,
        url: new URL(plugin.descriptor.manifest.entry.worker!, plugin.descriptor.baseUrl).href,
      }));

  store.add({
    dispose: options.projects.current.subscribe((project) => {
      code = undefined;
      current.clear();
      if (!project) return;
      const scope = new DisposableStore();
      const documents = scope.add(
        new DocumentService(projectFsBackend(project.fs), options.history),
      );
      scope.add(
        options.history.registerDeserializer(DOCUMENT_EDITS, (data, label) =>
          documents.restoreEditCommand(data, label),
        ),
      );
      scope.add(
        options.history.persist((id) => id.startsWith('file:'), indexedDbHistoryStore(project.id)),
      );
      const service = scope.add(
        new CodeService({
          projectId: project.id,
          fs: project.fs,
          rpc: options.rpc,
          documents,
          diagnostics,
          createWorker: createBrowserWorker,
          logger: logger.child('code'),
        }),
      );
      scope.add(services.provide(DocumentServiceToken, documents));
      scope.add(services.provide(CodeServiceToken, service));
      const catalog = scope.add(
        new CatalogService({
          project,
          code: service,
          documents,
          plugins: options.plugins,
          logger: logger.child('catalog'),
        }),
      );
      scope.add(services.provide(CatalogServiceToken, catalog));
      scope.add({ dispose: () => diagnostics.clear('typescript') });

      const loaded = new Map<string, string>();
      const syncWorkerPlugins = () => {
        const entries = new Map(workerEntries().map((entry) => [entry.name, entry.url]));
        for (const [name, url] of loaded) {
          if (entries.get(name) === url) continue;
          loaded.delete(name);
          void service.unloadWorkerPlugin(name);
        }
        for (const [name, url] of entries) {
          if (loaded.has(name)) continue;
          loaded.set(name, url);
          void service.loadWorkerPlugin(name, url);
        }
      };
      syncWorkerPlugins();
      scope.add(options.plugins.onDidChange(syncWorkerPlugins));
      code = service;
      current.value = scope;
    }),
  });

  const commands = services.get(CoreServices.Commands);
  const extensions = services.get(CoreServices.Extensions);

  store.add(
    options.plugins.registerContributionHandler<z.output<typeof DocumentEditorSchema>[]>({
      key: 'documentEditors',
      validator: z.array(DocumentEditorSchema),
      apply: (values, plugin) => {
        const registered = new DisposableStore();
        for (const value of values) {
          registered.add(
            extensions.contribute(DOCUMENT_EDITORS, value, { owner: plugin.manifest.name }),
          );
        }
        return registered;
      },
    }),
  );
  store.add(
    commands.register({
      id: 'documents.open',
      title: 'Open file',
      palette: false,
      category: 'File',
      handler: async (_services, path: unknown, open: unknown = {}) => {
        if (typeof path !== 'string') return;
        const [editor] = editorsFor(extensions, path);
        if (!editor) {
          options.notifications.notify('info', `No editor can open ${path}`, {
            detail: 'Install a plugin that edits this kind of file.',
          });
          return;
        }
        if (editor.command) await commands.execute(editor.command, path, open);
        else await commands.execute('workbench.openWidget', editor.widget);
      },
    }),
  );

  store.add(
    commands.register({
      id: 'code.check',
      title: 'Check file for problems',
      palette: false,
      category: 'Code',
      handler: async (_services, target: unknown) => {
        const path = Array.isArray(target) ? target[0] : target;
        if (!code || typeof path !== 'string' || !isCodeFile(path)) return;
        const problems = await code.refreshDiagnostics([path]);
        const errors = problems.filter((problem) => problem.severity === 'error').length;
        options.notifications.notify(
          errors ? 'warning' : 'success',
          errors
            ? `${errors} problem${errors > 1 ? 's' : ''} in ${path}`
            : `No problems in ${path}`,
          errors
            ? {
                detail: problems
                  .slice(0, 3)
                  .map((problem) => problem.message)
                  .join('\n'),
              }
            : {},
        );
      },
    }),
  );
  store.add(
    extensions.contribute(
      FILE_ACTIONS,
      {
        id: 'code.check',
        title: 'Check file for problems',
        command: 'code.check',
        group: 'z-code',
        when: 'fileSelectionCount == 1 && fileExtname =~ /^\\.[cm]?[jt]sx?$/',
      },
      { owner: 'core' },
    ),
  );

  return {
    reloadWorkerPlugin: (name, url) => {
      const busted = new URL(url);
      busted.searchParams.set('v', String(Date.now()));
      void code?.loadWorkerPlugin(name, busted.href);
    },
    dispose: () => store.dispose(),
  };
};
