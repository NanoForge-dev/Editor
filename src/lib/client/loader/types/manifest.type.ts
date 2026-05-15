export interface IManifest {
  version: string;
  files: { path: string }[];
}

export interface IExtendedManifestFile {
  gamePath: string;
  localPath: string;
}
