import type { Keybinding } from '../extension-point/keybinding.extension-point';

export interface KeymapOverride {
  readonly command: string;
  readonly key: string;
  readonly when?: string | undefined;
  /** Arguments the command runs with (a shortcut for a menu entry such as _View: Game_). */
  readonly args?: readonly unknown[] | undefined;
  /** Removes this shortcut of the command, whatever layer below added it. */
  readonly remove?: boolean | undefined;
}

export interface ResolvedKeybinding extends Keybinding {
  readonly strokes: readonly string[];
  readonly source: 'default' | 'preset' | 'user';
}

export interface KeybindingConflict {
  readonly key: string;
  readonly bindings: readonly ResolvedKeybinding[];
}
