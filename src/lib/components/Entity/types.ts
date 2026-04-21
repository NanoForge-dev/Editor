export interface Entity {
  id: string;
  name: string;
  type: 'entity' | 'folder';
  children?: Entity[];
}

export interface RegistryComponentManifest {
  name: string;
  type: 'component' | 'system';
  description: string;
  tags: string[];
  _file: string;
}
