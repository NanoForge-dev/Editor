export interface Entity {
  id: string;
  name: string;
  type: 'entity' | 'folder';
  children?: Entity[];
}
