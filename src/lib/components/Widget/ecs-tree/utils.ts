import type { Entity } from '$lib/client/ecs';

import type { TreeEntity, TreeFolder, TreeNode } from './types';

export const resolveParentPath = (path: string): string => {
  if (!path) return '';
  const parts = path.split('/');
  return parts.slice(0, -1).join('/');
};

export function buildTree(
  entities: (Entity & { scene?: string })[],
  extraFolderPaths: Iterable<string> = [],
): TreeNode[] {
  const folderMap = new Map<string, TreeFolder>();
  const root: TreeNode[] = [];

  function getOrCreate(path: string): TreeFolder {
    if (folderMap.has(path)) return folderMap.get(path)!;
    const parts = path.split('/');
    const folder: TreeFolder = { kind: 'folder', name: parts.at(-1)!, path, children: [] };
    folderMap.set(path, folder);
    const parentPath = parts.slice(0, -1).join('/');
    (parentPath ? getOrCreate(parentPath).children : root).push(folder);
    return folder;
  }

  for (const path of extraFolderPaths) if (path) getOrCreate(path);
  for (const entity of entities) {
    (entity.treePath ? getOrCreate(entity.treePath).children : root).push({
      kind: 'entity',
      id: entity.id,
      scene: entity.scene,
    });
  }

  function sort(nodes: TreeNode[]): TreeNode[] {
    const folders = nodes
      .filter((n): n is TreeFolder => n.kind === 'folder')
      .sort((a, b) => a.name.localeCompare(b.name));
    const entities = nodes
      .filter((n): n is TreeEntity => n.kind === 'entity')
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const f of folders) f.children = sort(f.children);
    return [...folders, ...entities];
  }

  return sort(root);
}

export function folderPaths(treePath: string): string[] {
  if (!treePath) return [];
  const parts = treePath.split('/');
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}
