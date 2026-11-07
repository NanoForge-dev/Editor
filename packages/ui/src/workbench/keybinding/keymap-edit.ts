import type { Keybinding } from '../extension-point/keybinding.extension-point';
import type { KeymapOverride, ResolvedKeybinding } from './keymap.type';
import { parseKeybinding } from './keystroke';
import { actionId, resolveKeymap } from './resolve-keymap';

/**
 * The layers of a keymap while one scope's overrides are edited: `own` is that scope's list,
 * `before` and `after` the lists of the scopes applied before and after it (the account's
 * overrides apply before this machine's).
 */
export interface KeymapLayers {
  readonly defaults: readonly Keybinding[];
  readonly preset: readonly KeymapOverride[];
  readonly before: readonly KeymapOverride[];
  readonly own: readonly KeymapOverride[];
  readonly after: readonly KeymapOverride[];
}

/** A shortcut of an action: the command with its arguments, and the keys. */
export interface ShortcutRef {
  readonly command: string;
  readonly args?: readonly unknown[];
  readonly key: string;
}

export const resolveLayers = (layers: KeymapLayers): ResolvedKeybinding[] =>
  resolveKeymap(layers.defaults, layers.preset, [...layers.before, ...layers.own, ...layers.after]);

const strokesOf = (key: string): string | undefined => {
  try {
    return parseKeybinding(key).join(' ');
  } catch {
    return undefined;
  }
};

const sameShortcut = (entry: KeymapOverride, ref: ShortcutRef): boolean =>
  actionId(entry.command, entry.args) === actionId(ref.command, ref.args) &&
  strokesOf(entry.key) === strokesOf(ref.key);

/**
 * The edited scope's list after setting a shortcut of an action: present with a condition
 * (`{ when }`), or absent (`undefined`). Entries of the list about that shortcut are replaced by
 * the fewest that give the wanted result on top of the layers below: none when the layers below
 * already give it, a removal, an addition, or both (a default whose condition changes).
 */
export const setShortcut = (
  layers: KeymapLayers,
  ref: ShortcutRef,
  state: { readonly when?: string | undefined } | undefined,
): KeymapOverride[] => {
  const own = layers.own.filter((entry) => !sameShortcut(entry, ref));
  const action = actionId(ref.command, ref.args);
  const strokes = strokesOf(ref.key);
  const below = resolveKeymap(layers.defaults, layers.preset, [...layers.before, ...own]).filter(
    (binding) =>
      actionId(binding.command, binding.args) === action && binding.strokes.join(' ') === strokes,
  );
  const entry = {
    command: ref.command,
    key: ref.key,
    ...(ref.args?.length && { args: [...ref.args] }),
  };
  const when = state?.when?.trim();
  const already =
    state !== undefined && below.length === 1 && (below[0]!.when ?? '') === (when ?? '');
  if (already) return own;
  if (below.length) own.push({ ...entry, remove: true });
  if (state !== undefined) own.push({ ...entry, ...(when && { when }) });
  return own;
};

/** The edited scope's list without anything about an action: back to the layers below. */
export const resetAction = (
  own: readonly KeymapOverride[],
  command: string,
  args: readonly unknown[] = [],
): KeymapOverride[] => {
  const action = actionId(command, args);
  return own.filter((entry) => actionId(entry.command, entry.args) !== action);
};

/** Whether the user's overrides say anything about an action. */
export const isActionChanged = (
  overrides: readonly KeymapOverride[],
  command: string,
  args: readonly unknown[] = [],
): boolean => {
  const action = actionId(command, args);
  return overrides.some((entry) => actionId(entry.command, entry.args) === action);
};
