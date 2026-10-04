import { z } from 'zod';

import {
  type CommandRegistry,
  type ContextKeyService,
  type Disposable,
  DisposableStore,
  type ExtensionPoint,
  type ExtensionRegistry,
  type Logger,
  type Observable,
  type PluginHost,
  type StaticContributionHandler,
  derived,
} from '@nanoforge-dev/editor-kernel';
import { CoreSettings, type SettingsService } from '@nanoforge-dev/editor-settings';

import { StyleService } from '../../style/style-service';
import { BASE_CSS } from '../../theme/base-css';
import { KIT_CSS } from '../../theme/kit-css';
import { THEMES, ThemeService } from '../../theme/theme-service';
import type { ThemeDefinition } from '../../theme/tokens';
import { KEYBINDINGS, KeybindingSchema } from '../extension-point/keybinding.extension-point';
import { MENU_BAR, MENU_ITEMS, MenuItemSchema } from '../extension-point/menu.extension-point';
import {
  WIDGETS,
  type WidgetDescriptor,
  WidgetDescriptorSchema,
} from '../extension-point/widget.extension-point';
import { KeybindingService } from '../keybinding/keybinding-service';
import { KEYMAP_PRESETS, KeymapPresetSchema } from '../keybinding/keymap-presets';
import type { KeymapOverride } from '../keybinding/keymap.type';
import { NotificationService } from '../notification/notification-service';
import { PromptService } from '../prompt/prompt-service';

export interface ShellOptions {
  readonly extensions: ExtensionRegistry;
  readonly commands: CommandRegistry;
  readonly contextKeys: ContextKeyService;
  readonly settings: SettingsService;
  readonly logger: Logger;
  readonly plugins?: PluginHost;
  readonly target?: Window;
}

export interface Shell extends Disposable {
  readonly styles: StyleService;
  readonly themes: ThemeService;
  readonly notifications: NotificationService;
  readonly prompts: PromptService;
  readonly keybindings: KeybindingService;
}

/** Manifest handler registering each declared value on an extension point. */
const listHandler = <T>(
  key: string,
  schema: z.ZodType<T>,
  register: (value: T, owner: string) => Disposable,
): StaticContributionHandler<T[]> => ({
  key,
  validator: z.array(schema) as unknown as z.ZodType<T[]>,
  apply: (values, plugin) => {
    const store = new DisposableStore();
    for (const value of values) store.add(register(value, plugin.manifest.name));
    return store;
  },
});

/** App-wide UI services: styles, theme, notifications, prompts, keybindings, menu bar. */
export const setupShell = (options: ShellOptions): Shell => {
  const { extensions, commands, contextKeys, settings, logger } = options;
  const store = new DisposableStore();
  const styles = new StyleService();
  store.add(styles.inject('core', BASE_CSS, { layer: 'reset' }));
  store.add(styles.inject('core', KIT_CSS, { layer: 'ui' }));
  const themes = store.add(
    new ThemeService(extensions, styles, settings.observe(CoreSettings.theme)),
  );
  const notifications = new NotificationService();
  const prompts = new PromptService();
  const keybindings = store.add(
    new KeybindingService(
      extensions,
      commands,
      contextKeys,
      settings.observe(CoreSettings.keymapOverrides) as Observable<readonly KeymapOverride[]>,
      logger,
      derived(
        [settings.observe(CoreSettings.keymapPreset), extensions.observe(KEYMAP_PRESETS)],
        (id, presets) => presets.find((preset) => preset.value.id === id)?.value.bindings ?? [],
      ),
    ),
  );
  store.add(keybindings.attach(options.target ?? window));

  const contribute = <T>(point: ExtensionPoint<T>, values: T[]) => {
    for (const value of values) store.add(extensions.contribute(point, value, { owner: 'core' }));
  };
  contribute(MENU_BAR, [
    { id: 'file', title: 'File', order: 0 },
    { id: 'edit', title: 'Edit', order: 1 },
    { id: 'view', title: 'View', order: 2 },
    { id: 'help', title: 'Help', order: 9 },
  ]);
  contribute(KEYBINDINGS, [
    { key: 'Mod+Z', command: 'history.undo', when: '!textInputFocus', args: [] },
    { key: 'Mod+Shift+Z', command: 'history.redo', when: '!textInputFocus', args: [] },
    { key: 'Mod+Y', command: 'history.redo', when: '!textInputFocus', args: [] },
    { key: 'F6', command: 'workbench.focusNextPart', args: [] },
    { key: 'Shift+F6', command: 'workbench.focusPreviousPart', args: [] },
  ]);
  contribute(MENU_ITEMS, [
    { menu: 'edit', command: 'history.undo', group: 'history', order: 0, args: [] },
    { menu: 'edit', command: 'history.redo', group: 'history', order: 1, args: [] },
    { menu: 'view', command: 'appearance.toggleTheme', group: 'z-appearance', order: 0, args: [] },
  ]);

  store.add(
    commands.register({
      id: 'appearance.toggleTheme',
      title: 'Toggle light/dark theme',
      category: 'View',
      handler: async () => {
        const current = themes.current.get();
        const next = themes.themes.find((theme) => theme.kind !== current.kind) ?? current;
        const scope = settings.hasStore('account') ? 'account' : 'machine';
        await settings.set(CoreSettings.theme, next.id, scope);
      },
    }),
  );

  if (options.plugins) {
    const host = options.plugins;
    store.add(
      host.registerContributionHandler(
        listHandler(
          'widgets',
          WidgetDescriptorSchema as unknown as z.ZodType<WidgetDescriptor>,
          (value, owner) => extensions.contribute(WIDGETS, value, { owner }),
        ),
      ),
    );
    store.add(
      host.registerContributionHandler(
        listHandler('menus', MenuItemSchema, (value, owner) =>
          extensions.contribute(MENU_ITEMS, value, { owner }),
        ),
      ),
    );
    store.add(
      host.registerContributionHandler(
        listHandler('keybindings', KeybindingSchema, (value, owner) =>
          extensions.contribute(KEYBINDINGS, value, { owner }),
        ),
      ),
    );
    store.add(
      host.registerContributionHandler(
        listHandler('keymapPresets', KeymapPresetSchema, (value, owner) =>
          extensions.contribute(KEYMAP_PRESETS, value, { owner }),
        ),
      ),
    );
    store.add(
      host.registerContributionHandler(
        listHandler('themes', z.unknown() as z.ZodType<ThemeDefinition>, (value, owner) =>
          extensions.contribute(THEMES, value, { owner }),
        ),
      ),
    );
  }

  return { styles, themes, notifications, prompts, keybindings, dispose: () => store.dispose() };
};
