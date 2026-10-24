import { z } from 'zod';

import { type ExtensionPoint, defineExtensionPoint } from '@nanoforge-dev/editor-kernel';

/** `Ctrl+Shift+P`, `Mod+Z` (Cmd on macOS, Ctrl elsewhere), chords: `Ctrl+K Ctrl+S`. */
export const KeybindingSchema = z.object({
  key: z.string().min(1),
  command: z.string().min(1),
  when: z.string().optional(),
  args: z.array(z.unknown()).default([]),
});
export type Keybinding = z.output<typeof KeybindingSchema>;
export const KEYBINDINGS: ExtensionPoint<Keybinding> = defineExtensionPoint('ui.keybindings', {
  validator: KeybindingSchema,
});
