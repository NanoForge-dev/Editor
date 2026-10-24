import {
  type EditorAction,
  type KeymapLayers,
  type ResolvedKeybinding,
  actionId,
  actionLabel,
  bindingsConflict,
  findConflicts,
  formatKeybinding,
  isActionChanged,
  parseKeybinding,
} from '@nanoforge-dev/editor-sdk/ui';

/** An action of the Keyboard shortcuts page, with its shortcuts. */
export interface KeymapRow {
  readonly action: EditorAction;
  readonly label: string;
  readonly bindings: readonly ResolvedKeybinding[];
  readonly changed: boolean;
  readonly conflict: boolean;
}

export interface KeymapFilter {
  readonly query: string;
  readonly onlyChanged: boolean;
  readonly onlyConflicts: boolean;
}

/** Shortcuts in a conflict the user's own changes are part of. */
export const userConflicts = (bindings: readonly ResolvedKeybinding[]): Set<ResolvedKeybinding> =>
  new Set(
    findConflicts(bindings)
      .filter((group) => group.bindings.some((binding) => binding.source === 'user'))
      .flatMap((group) => group.bindings),
  );

/** Every action, and the commands that have shortcuts but no title, with their shortcuts. */
export const keymapRows = (
  actions: readonly EditorAction[],
  layers: KeymapLayers,
  bindings: readonly ResolvedKeybinding[],
  conflicting: ReadonlySet<ResolvedKeybinding>,
): KeymapRow[] => {
  const overrides = [...layers.before, ...layers.own, ...layers.after];
  const known = new Set(actions.map((action) => action.id));
  const untitled = new Map<string, EditorAction>();
  for (const binding of bindings) {
    const id = actionId(binding.command, binding.args);
    if (known.has(id) || untitled.has(id)) continue;
    untitled.set(id, {
      id,
      command: binding.command,
      args: binding.args,
      title: id,
      when: [],
    });
  }
  return [...actions, ...untitled.values()].map((action) => {
    const own = bindings.filter((binding) => actionId(binding.command, binding.args) === action.id);
    return {
      action,
      label: actionLabel(action),
      bindings: own,
      changed: isActionChanged(overrides, action.command, action.args),
      conflict: own.some((binding) => conflicting.has(binding)),
    };
  });
};

/** The rows the filters keep: a search in labels, commands and shortcuts. */
export const filterRows = (rows: readonly KeymapRow[], filter: KeymapFilter): KeymapRow[] => {
  const needle = filter.query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!filter.onlyChanged || row.changed) &&
      (!filter.onlyConflicts || row.conflict) &&
      (!needle ||
        row.label.toLowerCase().includes(needle) ||
        row.action.command.toLowerCase().includes(needle) ||
        row.bindings.some(
          (binding) =>
            binding.strokes.join(' ').toLowerCase().includes(needle) ||
            formatKeybinding(binding.key).toLowerCase().includes(needle),
        )),
  );
};

/** The strokes of a shortcut, or undefined when it does not parse. */
export const strokesOf = (key: string): string[] | undefined => {
  try {
    return parseKeybinding(key);
  } catch {
    return undefined;
  }
};

/** Shortcuts of other actions a candidate would get in the way of. */
export const conflictsOf = (
  bindings: readonly ResolvedKeybinding[],
  action: EditorAction,
  key: string,
  when: string | undefined,
  editing?: ResolvedKeybinding,
): ResolvedKeybinding[] => {
  const strokes = strokesOf(key);
  if (!strokes) return [];
  const candidate: ResolvedKeybinding = {
    command: action.command,
    args: [...action.args],
    key,
    ...(when && { when }),
    strokes,
    source: 'user',
  };
  return bindings.filter((binding) => binding !== editing && bindingsConflict(candidate, binding));
};
