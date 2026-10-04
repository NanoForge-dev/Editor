import {
  COMMAND_METADATA,
  type CommandMetadata,
  type CommandRegistry,
  type ContextKeyService,
  type ExtensionRegistry,
} from '@nanoforge-dev/editor-kernel';

import { MENU_BAR, MENU_ITEMS, type MenuItem } from '../extension-point/menu.extension-point';
import { actionId } from '../keybinding/resolve-keymap';

/** Something the user can run from the palette or bind a shortcut to. */
export interface EditorAction {
  /** `actionId(command, args)`. */
  readonly id: string;
  readonly command: string;
  readonly args: readonly unknown[];
  readonly title: string;
  /** `File`, `Run`, or the menu path of a menu entry: `View › Panels`. */
  readonly category?: string;
  /** Condition the action is available in (the command's, and the menu entry's). */
  readonly when: readonly string[];
}

export interface ActionSources {
  readonly commands: CommandRegistry;
  readonly extensions: ExtensionRegistry;
}

/** `Category: Title`, as the palette and the keymap editor name an action. */
export const actionLabel = (action: Pick<EditorAction, 'title' | 'category'>): string =>
  action.category ? `${action.category}: ${action.title}` : action.title;

/**
 * Every action of the editor:
 * - commands with a title, registered or declared by the manifest of a plugin not active yet,
 *   unless they opt out (`palette: false`: they need arguments);
 * - menu entries that run a command with arguments (_View › Panels: Console_).
 */
export const listActions = ({ commands, extensions }: ActionSources): EditorAction[] => {
  const metadata = new Map<string, CommandMetadata>();
  for (const declared of extensions.getValues(COMMAND_METADATA)) {
    metadata.set(declared.id, declared);
  }
  for (const command of commands.getAll()) {
    const declared = metadata.get(command.id);
    metadata.set(command.id, {
      ...declared,
      ...(command.title !== undefined && { title: command.title }),
      ...(command.category !== undefined && { category: command.category }),
      ...(command.when !== undefined && { when: command.when }),
      ...(command.palette !== undefined && { palette: command.palette }),
    });
  }

  const actions = new Map<string, EditorAction>();
  for (const [command, { title, category, when, palette }] of metadata) {
    if (!title || palette === false) continue;
    actions.set(command, {
      id: command,
      command,
      args: [],
      title,
      ...(category && { category }),
      when: when ? [when] : [],
    });
  }

  const items = extensions.getValues(MENU_ITEMS);
  const bar = new Map(extensions.getValues(MENU_BAR).map((entry) => [entry.id, entry.title]));
  const parents = new Map<string, MenuItem>();
  for (const item of items) if (item.submenu) parents.set(item.submenu, item);
  /** `View › Panels` for the menu `view.panels`; undefined for context menus. */
  const pathOf = (menu: string): string | undefined => {
    const path: string[] = [];
    for (let current = menu, depth = 0; depth < 6; depth++) {
      const root = bar.get(current);
      if (root) return [root, ...path].join(' › ');
      const parent = parents.get(current);
      if (!parent) return undefined;
      path.unshift(parent.title ?? current);
      current = parent.menu;
    }
    return undefined;
  };
  for (const item of items) {
    if (!item.command || !item.args.length) continue;
    const category = pathOf(item.menu);
    const title = item.title ?? metadata.get(item.command)?.title;
    if (!category || !title) continue;
    const id = actionId(item.command, item.args);
    if (actions.has(id)) continue;
    const commandWhen = metadata.get(item.command)?.when;
    actions.set(id, {
      id,
      command: item.command,
      args: item.args,
      title,
      category,
      when: [commandWhen, item.when].filter((clause): clause is string => !!clause),
    });
  }
  return [...actions.values()].sort((a, b) => actionLabel(a).localeCompare(actionLabel(b)));
};

/** Whether an action can run in the current context. */
export const isActionEnabled = (action: EditorAction, context: ContextKeyService): boolean =>
  action.when.every((clause) => context.evaluate(clause));
