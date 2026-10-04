import { type z } from 'zod';

import type { HistoryService } from '@nanoforge-dev/editor-history';
import {
  type CommandRegistry,
  type ContextKeyService,
  type Disposable,
  DisposableStore,
  type ExtensionRegistry,
  type Logger,
  type ServiceAccessor,
  observe,
} from '@nanoforge-dev/editor-kernel';
import { SLOT_IDS, type SlotId, isSlotVisible } from '@nanoforge-dev/editor-layout';
import { CoreSettings, type SettingsService } from '@nanoforge-dev/editor-settings';

import { MENU_ITEMS, MenuItemSchema } from '../extension-point/menu.extension-point';
import { WIDGETS } from '../extension-point/widget.extension-point';
import { DragController } from '../layout/drag-controller';
import { LayoutController } from '../layout/layout-controller';
import { SLOT_LABELS } from '../parts/tab-menu';
import { WorkbenchService } from '../service/workbench-service';
import type { WorkbenchContext } from '../workbench-context';
import type { Shell } from './setup-shell';

export interface WorkbenchSetupOptions {
  readonly shell: Shell;
  readonly services: ServiceAccessor;
  readonly extensions: ExtensionRegistry;
  readonly commands: CommandRegistry;
  readonly contextKeys: ContextKeyService;
  readonly settings: SettingsService;
  readonly history: HistoryService;
  readonly logger: Logger;
  /** Activates plugins (`onWidget:<id>`). */
  readonly activate: (event: string) => Promise<void>;
}

/** The workbench of an open project: layout, widget host and their commands and menus. */
export const setupWorkbench = (options: WorkbenchSetupOptions): WorkbenchContext & Disposable => {
  const { extensions, commands, settings, logger, shell } = options;
  const store = new DisposableStore();
  const layout = store.add(
    new LayoutController({ extensions, history: options.history, settings, logger }),
  );
  const workbench = store.add(
    new WorkbenchService({
      services: options.services,
      extensions,
      styles: shell.styles,
      layout,
      contextKeys: options.contextKeys,
      settings,
      activate: options.activate,
      logger,
    }),
  );
  const drag = new DragController();

  /** `needsArgs`: run from menu entries that give the arguments, never from the palette. */
  const register = (
    id: string,
    title: string,
    handler: (...args: never[]) => unknown,
    needsArgs = false,
  ) =>
    store.add(
      commands.register({
        id,
        title,
        category: 'View',
        ...(needsArgs && { palette: false }),
        handler: (_services, ...args) => handler(...(args as never[])),
      }),
    );

  register('workbench.openWidget', 'Open panel', (widgetId: string) => layout.open(widgetId), true);
  register('workbench.closeWidget', 'Close panel', (instanceId?: string) => {
    const target = instanceId ?? options.contextKeys.get<string>('focusedWidget');
    return target ? layout.close(target) : undefined;
  });
  register(
    'workbench.toggleSlot',
    'Toggle dock',
    (slot: SlotId) => layout.showSlot(slot, !isSlotVisible(layout.current, slot)),
    true,
  );
  register('layout.saveAs', 'Save layout as…', async () => {
    const name = await shell.prompts.ask({
      title: 'Save layout',
      label: 'Layout name',
      value: settings.get(CoreSettings.layoutActive),
      confirm: 'Save layout',
      validate: (value) => (value.length > 40 ? 'Use at most 40 characters' : undefined),
    });
    if (!name) return;
    await layout.saveAs(name);
    shell.notifications.notify('success', `Layout "${name}" saved`);
  });
  register('layout.switch', 'Switch layout', (name: string) => layout.switchTo(name), true);
  register('layout.reset', 'Reset layout', async () => {
    await layout.reset();
    shell.notifications.notify('info', 'Layout reset to default');
  });

  const dynamic = store.add(new DisposableStore());
  const refreshMenus = () => {
    dynamic.clear();
    const add = (item: z.input<typeof MenuItemSchema>) =>
      dynamic.add(extensions.contribute(MENU_ITEMS, MenuItemSchema.parse(item), { owner: 'core' }));
    add({ menu: 'view', submenu: 'view.panels', title: 'Panels', group: 'layout', order: 0 });
    add({ menu: 'view', submenu: 'view.screens', title: 'Screens', group: 'layout', order: 1 });
    add({ menu: 'view', submenu: 'view.docks', title: 'Docks', group: 'layout', order: 2 });
    add({ menu: 'view', submenu: 'view.layouts', title: 'Layouts', group: 'layout', order: 3 });
    const widgets = extensions
      .getValues(WIDGETS)
      .filter((widget) => options.contextKeys.evaluate(widget.when));
    for (const widget of widgets.sort((a, b) => a.title.localeCompare(b.title))) {
      add({
        menu: widget.kind === 'screen' ? 'view.screens' : 'view.panels',
        command: 'workbench.openWidget',
        args: [widget.id],
        title: widget.title,
        order: widget.order,
      });
    }
    for (const slot of SLOT_IDS) {
      add({
        menu: 'view.docks',
        command: 'workbench.toggleSlot',
        args: [slot],
        title: `${SLOT_LABELS[slot]} dock`,
      });
    }
    add({ menu: 'view.layouts', command: 'layout.saveAs', group: 'manage', order: 0 });
    add({ menu: 'view.layouts', command: 'layout.reset', group: 'manage', order: 1 });
    for (const name of layout.savedNames) {
      add({
        menu: 'view.layouts',
        command: 'layout.switch',
        args: [name],
        title: name,
        group: 'saved',
      });
    }
  };
  refreshMenus();
  store.add(extensions.onDidChange((point) => point.id === WIDGETS.id && refreshMenus()));
  store.add(
    observe(settings.observe(CoreSettings.layoutSaved), refreshMenus, { immediate: false }),
  );

  return {
    workbench,
    layout,
    drag,
    notifications: shell.notifications,
    prompts: shell.prompts,
    keybindings: shell.keybindings,
    extensions,
    commands,
    contextKeys: options.contextKeys,
    logger,
    dispose: () => store.dispose(),
  };
};
