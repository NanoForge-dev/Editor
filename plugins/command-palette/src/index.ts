import { type Component, mount, unmount } from 'svelte';

import { EditorServices, type ServiceAccessor, definePlugin } from '@nanoforge-dev/editor-sdk';
import {
  CODE_EDITOR_ACTIVE_FILE,
  type EditorAction,
  NotificationServiceToken,
  SETTINGS_PAGES,
  type SettingsPageApi,
  StyleServiceToken,
  isActionEnabled,
  listActions,
  registerIcons,
} from '@nanoforge-dev/editor-sdk/ui';

import { ICONS } from './icons';
import KeymapPage from './keymap/KeymapPage.svelte';
import { KEYMAP_PAGE, OVERRIDES, PRESET } from './keymap/keymap.const';
import Palette, { type PaletteResult } from './palette/Palette.svelte';
import { PREFIXES } from './palette/palette-model';
import { readRecent, rememberRecent } from './palette/recent';

export default definePlugin({
  async activate(context) {
    const { services } = context;
    const css = await fetch(context.resolveAsset('command-palette.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(services.get(StyleServiceToken).inject(context.name, css));
    context.subscriptions.add(registerIcons(ICONS));

    const commands = services.get(EditorServices.Commands);
    const extensions = services.get(EditorServices.Extensions);
    const contextKeys = services.get(EditorServices.ContextKeys);
    const notify = (kind: 'info' | 'error', title: string, detail?: string) =>
      services.tryGet(NotificationServiceToken)?.notify(kind, title, detail ? { detail } : {});

    let palette:
      | {
          component: ReturnType<typeof mount>;
          target: HTMLElement;
          previous: HTMLElement | null;
          actions: readonly EditorAction[];
          activeFile: string | undefined;
        }
      | undefined;

    const run = async (result: PaletteResult) => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      try {
        if (result.kind === 'action') {
          rememberRecent(result.action.id);
          await commands.execute(result.action.command, ...result.action.args);
        } else {
          await commands.execute('documents.open', result.path, {
            ...(result.line !== undefined && { line: result.line, column: result.column ?? 1 }),
          });
        }
      } catch (error) {
        notify(
          'error',
          result.kind === 'action'
            ? `${result.action.title} could not run`
            : `${result.path} could not be opened`,
          error instanceof Error ? error.message : String(error),
        );
      }
    };

    const close = (result?: PaletteResult) => {
      if (!palette) return;
      const { component, target, previous } = palette;
      palette = undefined;
      const back = result?.kind === 'open' ? null : previous;
      if (back?.isConnected && back !== document.body) back.focus();
      else (document.activeElement as HTMLElement | null)?.blur?.();
      void unmount(component);
      target.remove();
      if (result) void run(result);
    };
    context.subscriptions.add({ dispose: () => close() });

    const open = (prefix: string) => {
      const previous =
        palette?.previous ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      const actions =
        palette?.actions ??
        listActions({ commands, extensions }).filter((action) =>
          isActionEnabled(action, contextKeys),
        );
      const activeFile = palette
        ? palette.activeFile
        : contextKeys.get<string>(CODE_EDITOR_ACTIVE_FILE);
      if (palette) {
        void unmount(palette.component);
        palette.target.remove();
      }
      const target = document.createElement('div');
      document.body.append(target);
      palette = {
        target,
        previous,
        actions,
        activeFile,
        component: mount(Palette, {
          target,
          props: { services, prefix, actions, activeFile, recent: readRecent(), onclose: close },
        }),
      };
    };

    for (const [id, prefix] of [
      ['palette.show', PREFIXES.commands],
      ['palette.files', ''],
      ['palette.line', PREFIXES.line],
      ['palette.symbols', PREFIXES.symbols],
    ] as const) {
      context.subscriptions.add(context.registerCommand(id, () => open(prefix)));
    }

    context.subscriptions.add(
      context.contribute(SETTINGS_PAGES, {
        id: KEYMAP_PAGE,
        title: 'Keyboard shortcuts',
        icon: 'keyboard',
        order: 0,
        settings: [OVERRIDES, PRESET],
        component: KeymapPage as Component<{ services: ServiceAccessor; page: SettingsPageApi }>,
      }),
    );
    context.subscriptions.add(
      context.registerCommand('keymap.open', () => commands.execute('settings.open', KEYMAP_PAGE)),
    );
  },
});
