import { parseWhen } from '@nanoforge-dev/editor-kernel';

import type { Keybinding } from '../extension-point/keybinding.extension-point';
import type { KeybindingConflict, KeymapOverride, ResolvedKeybinding } from './keymap.type';
import { parseKeybinding, startsWith } from './keystroke';

/** Identity of what a shortcut runs: a command with its arguments. */
export const actionId = (command: string, args: readonly unknown[] = []): string =>
  args.length ? `${command} ${JSON.stringify(args)}` : command;

const SOURCE_ORDER = { user: 0, preset: 1, default: 2 } as const;

/**
 * The effective shortcuts: the defaults, then the preset's entries, then the user's overrides
 * (account first, then this machine), applied in order. A `remove` entry cancels the shortcut
 * whatever added it, and a later entry can add it back. The user's shortcuts come first (they
 * win when two shortcuts match), then the preset's, then the defaults.
 */
export const resolveKeymap = (
  defaults: readonly Keybinding[],
  preset: readonly KeymapOverride[],
  overrides: readonly KeymapOverride[],
  onInvalid?: (binding: Keybinding, error: unknown) => void,
): ResolvedKeybinding[] => {
  const resolve = (
    binding: Keybinding,
    source: ResolvedKeybinding['source'],
  ): ResolvedKeybinding | undefined => {
    try {
      if (binding.when) parseWhen(binding.when);
      return { ...binding, strokes: parseKeybinding(binding.key), source };
    } catch (error) {
      onInvalid?.(binding, error);
      return undefined;
    }
  };
  let bindings = defaults.flatMap((binding) => resolve(binding, 'default') ?? []);
  const apply = (entries: readonly KeymapOverride[], source: 'preset' | 'user') => {
    for (const entry of entries) {
      const resolved = resolve(
        {
          key: entry.key,
          command: entry.command,
          args: [...(entry.args ?? [])],
          ...(entry.when && { when: entry.when }),
        },
        source,
      );
      if (!resolved) continue;
      const action = actionId(resolved.command, resolved.args);
      const strokes = resolved.strokes.join(' ');
      if (entry.remove) {
        bindings = bindings.filter(
          (binding) =>
            actionId(binding.command, binding.args) !== action ||
            binding.strokes.join(' ') !== strokes,
        );
      } else if (
        !bindings.some(
          (binding) =>
            actionId(binding.command, binding.args) === action &&
            binding.strokes.join(' ') === strokes &&
            (binding.when ?? '') === (resolved.when ?? ''),
        )
      ) {
        bindings.push(resolved);
      }
    }
  };
  apply(preset, 'preset');
  apply(overrides, 'user');
  return bindings
    .map((binding, index) => ({ binding, index }))
    .sort(
      (a, b) =>
        SOURCE_ORDER[a.binding.source] - SOURCE_ORDER[b.binding.source] || a.index - b.index,
    )
    .map(({ binding }) => binding);
};

/** Two conditions can be true together as far as the editor can tell: equal, or one is absent. */
const whenOverlaps = (a: string | undefined, b: string | undefined): boolean =>
  !a?.trim() || !b?.trim() || a.trim() === b.trim();

/**
 * Whether two shortcuts get in each other's way: different actions, conditions that overlap, and
 * the same keys or one hiding the other's chord (`Ctrl+K` against `Ctrl+K S`).
 */
export const bindingsConflict = (a: ResolvedKeybinding, b: ResolvedKeybinding): boolean =>
  actionId(a.command, a.args) !== actionId(b.command, b.args) &&
  whenOverlaps(a.when, b.when) &&
  (startsWith(a.strokes, b.strokes) || startsWith(b.strokes, a.strokes));

/** Shortcuts that conflict, grouped by the keys they share (the shortest of each group). */
export const findConflicts = (bindings: readonly ResolvedKeybinding[]): KeybindingConflict[] => {
  const groups = new Map<string, Set<ResolvedKeybinding>>();
  for (let i = 0; i < bindings.length; i++) {
    for (let j = i + 1; j < bindings.length; j++) {
      const a = bindings[i]!;
      const b = bindings[j]!;
      if (!bindingsConflict(a, b)) continue;
      const shortest = a.strokes.length <= b.strokes.length ? a : b;
      const key = shortest.strokes.join(' ');
      const group = groups.get(key) ?? new Set();
      group.add(a).add(b);
      groups.set(key, group);
    }
  }
  return [...groups].map(([key, group]) => ({ key, bindings: [...group] }));
};
