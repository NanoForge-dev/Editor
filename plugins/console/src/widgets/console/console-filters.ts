import type { MenuEntry } from '@nanoforge-dev/editor-sdk/ui';

import type { ConsoleLine } from '../../store/console-store';
import { GROUPS, type GroupId, sourceLabel } from '../../store/log-sources';

export interface GroupStats {
  readonly lines: number;
  /** Warnings and errors: shown on a hidden group's chip. */
  readonly alerts: number;
}

/** Lines per group, and the warnings and errors each holds. */
export const consoleStats = (lines: readonly ConsoleLine[]): Record<GroupId, GroupStats> => {
  const result = Object.fromEntries(
    GROUPS.map((group) => [group.id, { lines: 0, alerts: 0 }]),
  ) as Record<GroupId, { lines: number; alerts: number }>;
  for (const line of lines) {
    const group = result[line.group];
    group.lines++;
    if (line.level === 'warn' || line.level === 'error') group.alerts++;
  }
  return result;
};

/** The Sources menu: every source seen, by group, checked when shown. */
export const sourcesMenu = (
  lines: readonly ConsoleLine[],
  hidden: readonly string[],
  toggle: (source: string) => void,
  showAll: () => void,
): MenuEntry[] => {
  const known = [...new Set([...lines.map((line) => line.source), ...hidden])].sort();
  const entries: MenuEntry[] = [];
  for (const group of GROUPS) {
    const sources = known.filter(
      (source) => lines.find((line) => line.source === source)?.group === group.id,
    );
    if (!sources.length) continue;
    entries.push({
      kind: 'submenu',
      label: group.label,
      items: sources.map((source) => ({
        kind: 'item',
        id: source,
        label: sourceLabel(source),
        checked: !hidden.includes(source),
        onSelect: () => toggle(source),
      })),
    });
  }
  if (hidden.length) {
    entries.push(
      { kind: 'separator' },
      { kind: 'item', id: 'all', label: 'Show every source', onSelect: showAll },
    );
  }
  return entries.length
    ? entries
    : [{ kind: 'item', id: 'none', label: 'No sources yet', disabled: true, onSelect: () => {} }];
};
