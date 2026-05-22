import type { Project } from '$lib/client/project';

import { FileSystemManager } from '@utils-client/file-system';

import { SfsDirectory } from './sfs-directory';
import { SfsFile } from './sfs-file';

export type SyncFileSystemPart = 'build' | 'project';

const FS_ROUTE: Record<SyncFileSystemPart, string> = {
  build: '/fs/build',
  project: '/fs/project',
};

export class SyncFileSystem {
  public readonly route: string;
  public readonly projectId: string;
  public readonly cache: FileSystemManager;

  constructor(project: Project, part: SyncFileSystemPart) {
    this.route = FS_ROUTE[part];
    this.projectId = project.id;
    this.cache = new FileSystemManager(`projects/${project.id}/${part}`);
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
