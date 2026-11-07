import {
  COMMAND_METADATA,
  type CommandRegistry,
  type ContextKeyService,
  type ExtensionRegistry,
  type Logger,
} from '@nanoforge-dev/editor-kernel';

import type { MenuEntry } from '../../components/menu-entry.type';
import { MENU_ITEMS, type MenuItem } from '../extension-point/menu.extension-point';
import type { KeybindingService } from '../keybinding/keybinding-service';
import { formatKeybinding } from '../keybinding/keystroke';

export interface MenuContext {
  readonly extensions: ExtensionRegistry;
  readonly commands: CommandRegistry;
  readonly contextKeys: ContextKeyService;
  readonly keybindings?: KeybindingService;
  readonly logger?: Logger;
}

/** Title of a command: its runtime registration, else its manifest metadata, else its id. */
export const commandTitle = (context: MenuContext, command: string): string =>
  context.commands.get(command)?.title ??
  context.extensions.getValues(COMMAND_METADATA).find((metadata) => metadata.id === command)
    ?.title ??
  command;

/**
 * Menu entries of a menu id: contributed items passing their `when`, grouped (separators
 * between groups) and sorted by order.
 */
export const resolveMenu = (context: MenuContext, menu: string, depth = 0): MenuEntry[] => {
  if (depth > 5) return [];
  const items = context.extensions
    .getValues(MENU_ITEMS)
    .filter((item) => item.menu === menu && context.contextKeys.evaluate(item.when));
  const groups = new Map<string, MenuItem[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  const entries: MenuEntry[] = [];
  const sortedGroups = [...groups.entries()].sort(([a], [b]) =>
    a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b),
  );
  for (const [, group] of sortedGroups) {
    if (entries.length) entries.push({ kind: 'separator' });
    for (const item of group.sort((a, b) => a.order - b.order)) {
      if (item.submenu) {
        entries.push({
          kind: 'submenu',
          label: item.title ?? item.submenu,
          items: resolveMenu(context, item.submenu, depth + 1),
        });
        continue;
      }
      if (!item.command) continue;
      const command = item.command;
      const key = context.keybindings?.keyFor(command, item.args);
      entries.push({
        kind: 'item',
        id: `${menu}:${command}:${entries.length}`,
        label: item.title ?? commandTitle(context, command),
        ...(item.icon && { icon: item.icon }),
        ...(key && { shortcut: formatKeybinding(key) }),
        disabled: context.commands.has(command) && !context.commands.isEnabled(command),
        onSelect: () => {
          context.commands
            .execute(command, ...item.args)
            .catch((error: unknown) =>
              context.logger?.error(`Menu command ${command} failed`, error),
            );
        },
      });
    }
  }
  return entries;
};
