export interface TreeNode {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly children?: readonly TreeNode[];
  /** Muted secondary text after the label. */
  readonly detail?: string;
  /** Colors the detail: a state of the item (a changed file…). */
  readonly tone?: 'modified' | 'added' | 'deleted' | 'conflict';
  /** Tooltip of the detail. */
  readonly detailTitle?: string;
  /** Whether rows can be dragged (default true when the tree handles drops). */
  readonly draggable?: boolean;
  /** Whether other rows can be dropped inside it (default: when it has children). */
  readonly droppable?: boolean;
}

export interface TreeRow {
  readonly node: TreeNode;
  readonly depth: number;
  readonly parentId: string | null;
  readonly expandable: boolean;
}

export type DropPosition = 'before' | 'inside' | 'after';

export const TREE_DRAG_TYPE = 'application/x-nanoforge-tree';

/** Visible rows of a tree for a set of expanded nodes. */
export const flattenTree = (
  nodes: readonly TreeNode[],
  expanded: ReadonlySet<string>,
): TreeRow[] => {
  const rows: TreeRow[] = [];
  const walk = (list: readonly TreeNode[], depth: number, parentId: string | null) => {
    for (const node of list) {
      const expandable = !!node.children?.length;
      rows.push({ node, depth, parentId, expandable });
      if (expandable && expanded.has(node.id)) walk(node.children!, depth + 1, node.id);
    }
  };
  walk(nodes, 0, null);
  return rows;
};
