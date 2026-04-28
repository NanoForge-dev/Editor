export interface RegistryComponentManifest {
  name: string;
  type: 'component' | 'system';
  description: string;
  tags: string[];
  _file: string;
}
