import { z } from 'zod';

import { type ExtensionPoint, defineExtensionPoint } from '@nanoforge-dev/editor-kernel';

/** A named set of shortcuts applied on top of the defaults (it adds and removes). */
export const KeymapPresetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  bindings: z.array(
    z.object({
      command: z.string().min(1),
      key: z.string().min(1),
      when: z.string().optional(),
      args: z.array(z.unknown()).optional(),
      remove: z.boolean().optional(),
    }),
  ),
});
export type KeymapPreset = z.output<typeof KeymapPresetSchema>;
export const KEYMAP_PRESETS: ExtensionPoint<KeymapPreset> = defineExtensionPoint(
  'ui.keymapPresets',
  { validator: KeymapPresetSchema },
);

/** The preset every editor has: the defaults, unchanged. */
export const DEFAULT_KEYMAP_PRESET = 'default';
