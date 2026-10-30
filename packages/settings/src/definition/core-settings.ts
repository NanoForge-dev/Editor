import { z } from 'zod';

import { defineSetting } from './define-setting';

/** Settings owned by the editor core (3.9). Features of later phases read them. */
export const CoreSettings = {
  locale: defineSetting({
    key: 'editor.locale',
    schema: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
    default: 'en',
    title: 'Language',
    description: 'Language of the editor and plugins (en, fr…).',
    category: 'Editor/Appearance',
    scopes: ['account', 'machine'],
  }),
  theme: defineSetting({
    key: 'appearance.theme',
    schema: z.string().min(1),
    default: 'system',
    title: 'Theme',
    description:
      'Color theme of the editor: `system` follows the light or dark mode of the system.',
    category: 'Editor/Appearance',
    scopes: ['account', 'machine'],
  }),
  iconTheme: defineSetting({
    key: 'appearance.iconTheme',
    schema: z.string().min(1),
    default: 'nanoforge',
    title: 'Icon theme',
    description: 'Icons of the editor: panels, menus and files.',
    category: 'Editor/Appearance',
    scopes: ['account', 'machine'],
  }),
  density: defineSetting({
    key: 'appearance.density',
    schema: z.enum(['compact', 'normal', 'comfortable']),
    default: 'normal',
    title: 'Density',
    description: 'How much room the panels, rows and buttons take.',
    category: 'Editor/Appearance',
    scopes: ['account', 'machine'],
  }),
  cacheBudget: defineSetting({
    key: 'storage.cacheBudgetMb',
    schema: z.number().int().min(50).max(100_000),
    default: 500,
    title: 'Cache size',
    description:
      'Space (MB) the browser may use to keep project files, so they need not be downloaded again. Never more than a tenth of what the browser allows. Least recently used files go first.',
    category: 'Editor/Storage',
    scopes: ['machine'],
  }),
  cacheMaxAge: defineSetting({
    key: 'storage.cacheMaxAgeDays',
    schema: z.number().int().min(0).max(3650),
    default: 30,
    title: 'Forget projects after (days)',
    description:
      'Cached files of a project not opened for this many days are dropped (0 keeps them).',
    category: 'Editor/Storage',
    scopes: ['machine'],
  }),
  historyLimit: defineSetting({
    key: 'history.limit',
    schema: z.number().int().min(1).max(10_000),
    default: 100,
    title: 'Undo limit',
    description: 'Number of undo steps kept per document.',
    category: 'Editor/History',
  }),
  historyMergeWindow: defineSetting({
    key: 'history.mergeWindowMs',
    schema: z.number().int().min(0).max(10_000),
    default: 500,
    title: 'Undo merge window',
    description: 'Consecutive changes of the same value within this delay (ms) are one undo step.',
    category: 'Editor/History',
  }),
  welcomeShow: defineSetting({
    key: 'welcome.show',
    schema: z.boolean(),
    default: true,
    title: 'Show the welcome',
    description: 'Offer the tutorial on the home page. Help › Tutorial starts it at any time.',
    category: 'Editor/Appearance',
    scopes: ['account', 'machine'],
  }),
  tipsDismissed: defineSetting({
    key: 'tips.dismissed',
    schema: z.array(z.string()),
    default: [],
    title: 'Dismissed tips',
    description:
      'Panels whose first-time tip was put away. Remove one (or empty the list) to see its tip again.',
    category: 'Editor/Appearance',
    scopes: ['account', 'machine'],
  }),
  adoptionDismissed: defineSetting({
    key: 'adoption.dismissed',
    schema: z.array(z.string()),
    default: [],
    title: 'Dismissed suggestions',
    description:
      'Suggestions of the Project screen\'s "Adapt to the editor" report that were put away in this project.',
    category: 'Editor/Project',
    scopes: ['projectLocal'],
  }),
  layoutPreset: defineSetting({
    key: 'layout.preset',
    schema: z.enum(['simple', 'full']),
    default: 'simple',
    title: 'Default layout',
    description:
      'Simple shows only the main panels (files, hierarchy, scenes, inspector, console); All panels shows every one. Used when a layout is reset or none is saved yet.',
    category: 'Editor/Layout',
    scopes: ['account', 'machine'],
  }),
  layoutActive: defineSetting({
    key: 'layout.active',
    schema: z.string(),
    default: 'default',
    title: 'Active layout',
    category: 'Editor/Layout',
    scopes: ['account', 'machine', 'projectLocal'],
  }),
  layoutSaved: defineSetting({
    key: 'layout.saved',
    schema: z.record(z.string(), z.unknown()),
    default: {},
    title: 'Saved layouts',
    description: 'Named layouts (managed from the Window menu).',
    category: 'Editor/Layout',
    mergeStrategy: 'deep',
  }),
  keymapOverrides: defineSetting({
    key: 'keymap.overrides',
    schema: z.array(
      z.object({
        command: z.string(),
        key: z.string(),
        when: z.string().optional(),
        args: z.array(z.unknown()).optional(),
        remove: z.boolean().optional(),
      }),
    ),
    default: [],
    title: 'Keyboard shortcuts',
    description: 'Shortcuts added or removed on top of the defaults and the preset.',
    category: 'Editor/Keymap',
    mergeStrategy: 'union',
    scopes: ['account', 'machine'],
  }),
  keymapPreset: defineSetting({
    key: 'keymap.preset',
    schema: z.string(),
    default: 'default',
    title: 'Keymap preset',
    description: 'A set of shortcuts applied on top of the defaults.',
    category: 'Editor/Keymap',
    scopes: ['account', 'machine'],
  }),
  pluginsDisabled: defineSetting({
    key: 'plugins.disabled',
    schema: z.array(z.string()),
    default: [],
    title: 'Disabled plugins',
    description: 'Plugins not loaded (takes effect after a reload).',
    category: 'Editor/Plugins',
    mergeStrategy: 'union',
  }),
  pluginsAccount: defineSetting({
    key: 'plugins.account',
    schema: z.record(z.string(), z.string()),
    default: {},
    title: 'Plugins of my account',
    description:
      'Plugins installed for me from the marketplace, with version ranges. On another machine the editor offers to install them.',
    category: 'Editor/Plugins',
    scopes: ['account'],
  }),
  pluginsTrustedProjects: defineSetting({
    key: 'plugins.trustedProjects',
    schema: z.array(z.string()),
    default: [],
    title: 'Projects allowed to run their plugins',
    description:
      'On a hosted editor, the plugins a project keeps in .nanoforge/plugins run only in the projects listed here (by id). Anyone who can change the project can change its plugins.',
    category: 'Editor/Plugins',
    scopes: ['account'],
    mergeStrategy: 'union',
  }),
} as const;

/**
 * Plugins that `plugins.disabled` cannot turn off: the Settings plugin holds the switches that
 * turn plugins back on.
 */
export const REQUIRED_PLUGINS: readonly string[] = ['@nanoforge/settings-ui'];
