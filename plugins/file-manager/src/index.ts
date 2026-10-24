import { type Component, mount, unmount } from 'svelte';

import {
  EditorServices,
  HistoryServiceToken,
  ProjectServiceToken,
  RuntimeServiceToken,
  SettingsServiceToken,
  definePlugin,
} from '@nanoforge-dev/editor-sdk';
import {
  FILE_ICONS,
  NotificationServiceToken,
  PromptServiceToken,
  StyleServiceToken,
  WIDGET_VIEWS,
  type WidgetInstance,
  registerIcons,
} from '@nanoforge-dev/editor-sdk/ui';

import PreviewDialog from './dialogs/preview/PreviewDialog.svelte';
import { FILE_ICON_DEFAULTS, ICONS } from './icons';
import { FileManagerService } from './service/file-manager-service';
import { current } from './session/file-manager-session';
import { SETTING } from './settings/file-manager-settings.const';
import FilesView from './widgets/files/FilesView.svelte';

export const FILES_WIDGET = 'file-manager.files';
/** Undo/redo context of file operations (the widget's `historyContext`). */
export const FILES_HISTORY = 'file-manager';

export default definePlugin({
  async activate(context) {
    const { services } = context;
    const css = await fetch(context.resolveAsset('file-manager.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(services.get(StyleServiceToken).inject(context.name, css));
    context.subscriptions.add(registerIcons(ICONS));
    for (const icon of FILE_ICON_DEFAULTS) {
      context.subscriptions.add(context.contribute(FILE_ICONS, icon, { priority: -100 }));
    }
    context.subscriptions.add(
      context.contribute(WIDGET_VIEWS, {
        id: FILES_WIDGET,
        component: FilesView as Component<{ instance: WidgetInstance }>,
      }),
    );

    const history = services.get(HistoryServiceToken);
    const extensions = services.get(EditorServices.Extensions);
    const unsubscribe = services.get(ProjectServiceToken).current.subscribe((project) => {
      current.get()?.dispose();
      current.set(undefined);
      if (!project) return;
      current.set(
        new FileManagerService({
          project,
          history: history.registerContext({
            id: FILES_HISTORY,
            label: 'Files',
            owner: context.name,
          }),
          extensions,
          prompts: services.tryGet(PromptServiceToken),
          notifications: services.tryGet(NotificationServiceToken),
          executeCommand: (id, ...args) => context.executeCommand(id, ...args),
          logger: context.logger,
          local: services.tryGet(RuntimeServiceToken) !== undefined,
        }),
      );
    });
    context.subscriptions.add({
      dispose: () => {
        unsubscribe();
        current.get()?.dispose();
        current.set(undefined);
      },
    });

    const paths = (value: unknown): string[] | undefined =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : undefined;
    const folder = (value: unknown) => (typeof value === 'string' ? value : undefined);
    const settings = services.get(SettingsServiceToken);

    let dialog: ReturnType<typeof mount> | undefined;
    const closePreview = () => {
      if (dialog) void unmount(dialog);
      dialog = undefined;
    };
    context.subscriptions.add({ dispose: closePreview });
    const preview = (service: FileManagerService, arg: unknown) => {
      const path = folder(arg);
      if (!path) return;
      closePreview();
      const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
      const target = document.createElement('div');
      document.body.append(target);
      dialog = mount(PreviewDialog, {
        target,
        props: {
          path,
          url: service.fileUrl(path, service.entry(path)?.mtime),
          kind: ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(extension)
            ? 'audio'
            : ['mp4', 'webm'].includes(extension)
              ? 'video'
              : 'image',
          ondownload: () => void service.download(path),
          onclose: () => {
            closePreview();
            target.remove();
          },
        },
      });
    };
    const commands: [string, (service: FileManagerService, arg: unknown) => unknown][] = [
      ['fileManager.newFile', (service, arg) => service.newFile(folder(arg))],
      ['fileManager.newFolder', (service, arg) => service.newFolder(folder(arg))],
      ['fileManager.newFromTemplate', (service, arg) => service.newFromTemplate(String(arg))],
      ['fileManager.import', (service, arg) => service.pickFiles(folder(arg))],
      ['fileManager.rename', (service, arg) => service.rename(folder(arg))],
      ['fileManager.delete', (service, arg) => service.delete(paths(arg))],
      ['fileManager.duplicate', (service, arg) => service.duplicate(paths(arg))],
      ['fileManager.copy', (service, arg) => service.copyToClipboard('copy', paths(arg))],
      ['fileManager.cut', (service, arg) => service.copyToClipboard('cut', paths(arg))],
      ['fileManager.paste', (service, arg) => service.paste(folder(arg))],
      ['fileManager.reveal', (service, arg) => service.reveal(folder(arg))],
      ['fileManager.download', (service, arg) => service.download(folder(arg))],
      ['fileManager.copyPath', (service, arg) => service.copyPath(folder(arg))],
      ['fileManager.preview', (service, arg) => preview(service, arg)],
      [
        'fileManager.toggleHidden',
        () =>
          settings.set(
            SETTING.showHidden,
            !settings.get<boolean>(SETTING.showHidden),
            settings.hasStore('machine') ? 'machine' : 'account',
          ),
      ],
    ];
    let queue: Promise<unknown> = Promise.resolve();
    for (const [id, run] of commands) {
      context.subscriptions.add(
        context.registerCommand(id, (_services, arg?: unknown) => {
          const next = queue.then(() => {
            const service = current.get();
            return service ? run(service, arg) : undefined;
          });
          queue = next.catch(() => undefined);
          return next;
        }),
      );
    }
  },
});
