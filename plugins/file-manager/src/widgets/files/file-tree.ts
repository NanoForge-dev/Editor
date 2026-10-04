import { type FileEntry, basename } from '@nanoforge-dev/editor-sdk';
import type { FileDecoration, TreeNode } from '@nanoforge-dev/editor-sdk/ui';

import { type FileFilter, PACKAGES, fuzzyScore, isPackagePath } from '../../filter/file-filter';
import type { FileManagerService } from '../../service/file-manager-service';

/** What the Files panel shows: the project, its filters and the open folders. */
export interface FileTreeContext {
  readonly service: FileManagerService;
  readonly filter: FileFilter;
  readonly showHidden: boolean;
  readonly expanded: ReadonlySet<string>;
  readonly decorate: (entry: FileEntry) => FileDecoration | undefined;
}

/** Entries shown under `path` (hidden ones only with the toggle; packages apart). */
export const visibleEntries = (context: FileTreeContext, path: string): FileEntry[] =>
  context.service.project.fs
    .children(path)
    .filter((entry) => path !== '' || entry.path !== PACKAGES)
    .filter((entry) => context.showHidden || !context.filter.excludes(entry));

export const treeNode = (
  context: FileTreeContext,
  entry: FileEntry,
  children?: TreeNode[],
): TreeNode => {
  const directory = entry.kind === 'directory';
  const hidden = context.filter.excludes(entry);
  const readOnly = isPackagePath(entry.path);
  const decoration = context.decorate(entry);
  return {
    id: entry.path,
    label: basename(entry.path),
    icon:
      readOnly && entry.path === PACKAGES
        ? 'lock'
        : context.service.iconOf(entry, context.expanded.has(entry.path)),
    ...(hidden
      ? { detail: 'hidden' }
      : decoration && {
          detail: decoration.badge,
          ...(decoration.tone && { tone: decoration.tone }),
          ...(decoration.tooltip && { detailTitle: decoration.tooltip }),
        }),
    ...(readOnly && { draggable: false }),
    ...(directory && { children: children ?? [], droppable: !readOnly }),
  };
};

export const buildTree = (context: FileTreeContext, path: string): TreeNode[] =>
  visibleEntries(context, path).map((entry) =>
    treeNode(
      context,
      entry,
      entry.kind === 'directory' ? buildTree(context, entry.path) : undefined,
    ),
  );

/** Search: matching entries, inside their (expanded) folders. */
export const searchTree = (context: FileTreeContext, path: string, needle: string): TreeNode[] =>
  visibleEntries(context, path).flatMap((entry) => {
    const children = entry.kind === 'directory' ? searchTree(context, entry.path, needle) : [];
    if (fuzzyScore(needle, entry.path) < 0 && !children.length) return [];
    return [treeNode(context, entry, entry.kind === 'directory' ? children : undefined)];
  });

/** The folders a search result opens: every one that holds a match. */
export const openFolders = (nodes: readonly TreeNode[]): Set<string> => {
  const open = new Set<string>();
  const walk = (list: readonly TreeNode[]) => {
    for (const item of list) {
      if (item.children?.length) {
        open.add(item.id);
        walk(item.children);
      }
    }
  };
  walk(nodes);
  return open;
};

/** The entries of the grid: folders first, then by path. */
export const gridOrder = (entries: FileEntry[]): FileEntry[] =>
  entries.sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === 'directory' ? -1 : 1) || a.path.localeCompare(b.path),
  );
