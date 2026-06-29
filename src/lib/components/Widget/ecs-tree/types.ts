export interface PackageItems {
  icon: {
    name: string;
    color: string;
  };
  addTooltip?: string;
  disableAddTooltipNotSelected?: string;
  disableAddTooltipAlreadyAdded?: string;

  canAdd?: boolean;
  canDelete?: boolean;
  canImport?: boolean;
}

export type TreeEntity = { kind: 'entity'; id: string; scene?: string };
export type TreeFolder = { kind: 'folder'; name: string; path: string; children: TreeNode[] };
export type TreeNode = TreeEntity | TreeFolder;

export type EntityDragItem = { type: 'entity'; id: string } | { type: 'folder'; path: string };

export interface EntityDragContext {
  readonly dragging: EntityDragItem | null;
  startDrag(item: EntityDragItem): void;
  endDrag(): void;
  dropOnFolder(folderPath: string): void;
  dropOnEntity(entityId: string): void;
  dropOnRoot(): void;
}

export interface Package {
  id: string;
  name?: string;
  path?: string;
}
