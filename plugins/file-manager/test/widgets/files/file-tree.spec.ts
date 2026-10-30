import { describe, expect, it } from 'vitest';

import type { FileEntry } from '@nanoforge-dev/editor-sdk';

import { FileFilter } from '../../../src/filter/file-filter';
import {
  type FileTreeContext,
  buildTree,
  gridOrder,
  openFolders,
  searchTree,
  treeNode,
} from '../../../src/widgets/files/file-tree';

const ENTRIES: FileEntry[] = [
  { path: 'src', kind: 'directory' },
  { path: 'src/main.ts', kind: 'file' },
  { path: 'src/systems', kind: 'directory' },
  { path: 'src/systems/move.ts', kind: 'file' },
  { path: 'debug.log', kind: 'file' },
  { path: 'nf_modules', kind: 'directory' },
  { path: 'nf_modules/ball.ts', kind: 'file' },
] as FileEntry[];

const dirname = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const context = (overrides: Partial<FileTreeContext> = {}): FileTreeContext => ({
  service: {
    project: {
      fs: { children: (path: string) => ENTRIES.filter((entry) => dirname(entry.path) === path) },
    },
    iconOf: (entry: FileEntry, expanded: boolean) =>
      entry.kind === 'directory' ? (expanded ? 'folder-open' : 'folder') : 'file',
  } as never,
  filter: new FileFilter(['*.log']),
  showHidden: false,
  expanded: new Set(),
  decorate: () => undefined,
  ...overrides,
});

describe('file tree', () => {
  it('leaves out hidden files and the packages folder at the root', () => {
    expect(buildTree(context(), '').map((node) => node.id)).toEqual(['src']);
    const all = buildTree(context({ showHidden: true }), '');
    expect(all.map((node) => node.id)).toEqual(['src', 'debug.log']);
    expect(all.find((node) => node.id === 'debug.log')?.detail).toBe('hidden');
    expect(buildTree(context(), '')[0]?.children?.map((node) => node.id)).toEqual([
      'src/main.ts',
      'src/systems',
    ]);
  });

  it('marks packages read-only, shows decorations and open folders', () => {
    const packages = treeNode(context(), { path: 'nf_modules', kind: 'directory' } as FileEntry);
    expect(packages).toMatchObject({ icon: 'lock', draggable: false, droppable: false });
    const decorated = treeNode(
      context({
        expanded: new Set(['src']),
        decorate: () => ({ badge: 'M', tone: 'warning', tooltip: 'Modified' }),
      }),
      { path: 'src', kind: 'directory' } as FileEntry,
    );
    expect(decorated).toMatchObject({
      icon: 'folder-open',
      detail: 'M',
      tone: 'warning',
      detailTitle: 'Modified',
      droppable: true,
      children: [],
    });
  });

  it('searches inside folders, and opens the folders holding a match', () => {
    const found = searchTree(context(), '', 'move');
    expect(found.map((node) => node.id)).toEqual(['src']);
    expect([...openFolders(found)]).toEqual(['src', 'src/systems']);
    expect(searchTree(context(), '', 'zzz')).toEqual([]);
  });

  it('puts folders first in the grid, then sorts by path', () => {
    const order = gridOrder([
      { path: 'b.ts', kind: 'file' },
      { path: 'z', kind: 'directory' },
      { path: 'a.ts', kind: 'file' },
    ] as FileEntry[]);
    expect(order.map((entry) => entry.path)).toEqual(['z', 'a.ts', 'b.ts']);
  });
});
