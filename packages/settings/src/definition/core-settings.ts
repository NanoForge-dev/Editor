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
    default: 'nanoforge-dark',
    title: 'Theme',
    description: 'Color theme of the editor.',
    category: 'Editor/Appearance',
    scopes: ['account', 'machine'],
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
} as const;
