import { z } from 'zod';

import { type ExtensionPoint, defineExtensionPoint } from '@nanoforge-dev/editor-kernel';

/** Top level menus of the menu bar. */
export const MenuBarEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  order: z.number().default(0),
});
export type MenuBarEntry = z.output<typeof MenuBarEntrySchema>;
export const MENU_BAR: ExtensionPoint<MenuBarEntry> = defineExtensionPoint('ui.menuBar', {
  validator: MenuBarEntrySchema,
});

/** An item of a menu: runs a command (its title/icon by default) or opens a submenu. */
export const MenuItemSchema = z.object({
  /** Menu id: a menu bar entry (`file`, `edit`, `view`…), a submenu or a context menu id. */
  menu: z.string(),
  command: z.string().optional(),
  submenu: z.string().optional(),
  title: z.string().optional(),
  /** An icon before the label, e.g. `check` on the current choice of a list. */
  icon: z.string().optional(),
  /** Items are grouped (separated) by group, then sorted by order. */
  group: z.string().default('main'),
  order: z.number().default(0),
  when: z.string().optional(),
  args: z.array(z.unknown()).default([]),
});
export type MenuItem = z.output<typeof MenuItemSchema>;
export const MENU_ITEMS: ExtensionPoint<MenuItem> = defineExtensionPoint('ui.menuItems', {
  validator: MenuItemSchema,
});
