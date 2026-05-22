import { SESSION_PROJECT_HEADER } from '@utils/const';
import { HttpClient } from '@utils/http';

import { ConfigRepository } from './repositories/config.repository';
import { ProjectFsRepository } from './repositories/fs.repository';
import { ProjectLoaderRepository } from './repositories/loader.repository';
import { ProjectPackageRepository } from './repositories/package.repository';
import { ProjectRepository } from './repositories/project.repository';
import { ProjectSaveRepository } from './repositories/save.repository';

export interface ActionClient {
  config: ConfigRepository;
  fs: ProjectFsRepository;
  loader: ProjectLoaderRepository;
  package: ProjectPackageRepository;
  project: ProjectRepository;
  save: ProjectSaveRepository;
}

export const getActionClient = (projectId?: string): ActionClient => {
  const client = new HttpClient(
    '',
    projectId ? { headers: { [SESSION_PROJECT_HEADER]: projectId } } : {},
  );

  return {
    config: new ConfigRepository(client),
    fs: new ProjectFsRepository(client),
    loader: new ProjectLoaderRepository(client),
    package: new ProjectPackageRepository(client),
    project: new ProjectRepository(client),
    save: new ProjectSaveRepository(client),
  };
};

export const noProjectActions = getActionClient();
