import type { SettingsPage, TreeNode } from '@nanoforge-dev/editor-sdk/ui';

import type { CategoryNode } from '../../settings/setting-categories';

const toNodes = (list: readonly CategoryNode[]): TreeNode[] =>
  list.map((node) => ({
    id: node.id,
    label: node.label,
    ...(node.children.length && { children: toNodes(node.children) }),
  }));

/** The tree of the dialog: categories, contributed pages, then the editor's own pages. */
export const settingsTree = (
  categories: readonly CategoryNode[],
  pages: readonly SettingsPage[],
  options: { plugins: boolean; conflicts: boolean },
): TreeNode[] => [
  ...toNodes(categories),
  ...pages.map((contributed) => ({
    id: contributed.id,
    label: contributed.title,
    ...(contributed.icon && { icon: contributed.icon }),
  })),
  ...(options.plugins ? [{ id: 'plugins', label: 'Plugins', icon: 'plug' }] : []),
  { id: 'import', label: 'Import & export', icon: 'download' },
  ...(options.conflicts
    ? [{ id: 'conflicts', label: 'Sync conflicts', icon: 'triangle-alert' }]
    : []),
];
