import type { Project } from '$lib/client/project';

import { FileSystemManager } from '@utils-client/file-system';

import { SfsDirectory } from './sfs-directory';
import { SfsFile } from './sfs-file';
import { SfsTreeCache } from './sfs-tree-cache';

export type SyncFileSystemPart = 'build' | 'project';

const FS_ROUTE: Record<SyncFileSystemPart, string> = {
  build: '/fs/build',
  project: '/fs/project',
};

export class SyncFileSystem {
  public readonly project: Project;
  public readonly route: string;
  public readonly cache: FileSystemManager;
  public readonly treeCache: SfsTreeCache | undefined;

  constructor(project: Project, part: SyncFileSystemPart) {
    this.project = project;
    this.route = FS_ROUTE[part];
    this.cache = new FileSystemManager(`projects/${project.id}/${part}`);
    if (part === 'project') this.treeCache = new SfsTreeCache(project.id);
  }

  async init(): Promise<void> {
    await this.treeCache?.init();
  }

  async getFile(path: string): Promise<SfsFile> {
    return new SfsFile(
      this,
      (await this.cache.fileExist(path)) ? await this.cache.getFile(path, false) : null,
      path,
    );
  }

  async getDirectory(path?: string): Promise<SfsDirectory> {
    return new SfsDirectory(this, await this.cache.getDirectory(path, true), path ?? '');
  }
}
