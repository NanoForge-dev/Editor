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

import { registerIconFiles } from '../../components/icons';
import { StyleService } from '../../style/style-service';
import { BASE_CSS } from '../../theme/base-css';
import {
  ICON_THEMES,
  IconFileSchema,
  type IconThemeContribution,
  IconThemeContributionSchema,
  IconThemeService,
  iconFileUrl,
  iconThemeOf,
} from '../../theme/icon-theme';
import { KIT_CSS } from '../../theme/kit-css';
import type { ThemeContribution } from '../../theme/theme-contribution';
import { THEMES, ThemeService } from '../../theme/theme-service';
import type { Density } from '../../theme/tokens';
import { ChangesetPreviewService } from '../changeset/changeset-preview-service';
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
import { TourService } from '../tour/tour-service';
import { TOURS, type Tour, TourSchema } from '../tour/tour.extension-point';

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
  readonly iconThemes: IconThemeService;
  readonly notifications: NotificationService;
  readonly prompts: PromptService;
  readonly keybindings: KeybindingService;
  readonly tours: TourService;
  readonly changesets: ChangesetPreviewService;
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
    new ThemeService(
      extensions,
      styles,
      settings.observe(CoreSettings.theme),
      document.documentElement,
      { density: settings.observe(CoreSettings.density) as Observable<Density>, logger },
    ),
  );
  const iconThemes = store.add(
    new IconThemeService(extensions, settings.observe(CoreSettings.iconTheme), logger),
  );
  const notifications = new NotificationService();
  const prompts = new PromptService();
  const tours = store.add(new TourService(extensions, contextKeys, commands, notifications));
  const changesets = new ChangesetPreviewService();
  store.add(
    commands.register({
      id: 'tour.start',
      title: 'Start a tour',
      category: 'Help',
      palette: false,
      handler: (_services, id: unknown) => typeof id === 'string' && tours.start(id),
    }),
  );
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
        listHandler('tours', TourSchema as unknown as z.ZodType<Tour>, (value, owner) =>
          extensions.contribute(TOURS, value, { owner }),
        ),
      ),
    );
    store.add(
      host.registerContributionHandler({
        key: 'icons',
        validator: z.array(IconFileSchema) as unknown as z.ZodType<
          z.output<typeof IconFileSchema>[]
        >,
        apply: (icons, plugin) =>
          registerIconFiles(
            Object.fromEntries(
              icons.map((icon) => [icon.id, iconFileUrl(plugin.baseUrl, icon.path)]),
            ),
          ),
      }),
    );
    store.add(
      host.registerContributionHandler({
        key: 'iconThemes',
        validator: z.array(IconThemeContributionSchema) as unknown as z.ZodType<
          IconThemeContribution[]
        >,
        apply: (themes, plugin) => {
          const registrations = new DisposableStore();
          for (const theme of themes)
            registrations.add(
              extensions.contribute(ICON_THEMES, iconThemeOf(theme, plugin.baseUrl), {
                owner: plugin.manifest.name,
              }),
            );
          return registrations;
        },
      }),
    );
    store.add(
      host.registerContributionHandler(
        listHandler('themes', z.unknown() as z.ZodType<ThemeContribution>, (value, owner) =>
          extensions.contribute(THEMES, value, { owner }),
        ),
      ),
    );
  }

  return {
    styles,
    themes,
    iconThemes,
    notifications,
    prompts,
    keybindings,
    tours,
    changesets,
    dispose: () => store.dispose(),
  };
};
