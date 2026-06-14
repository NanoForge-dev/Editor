import { resolve } from 'path';

import { env } from '$env/dynamic/private';

export const resolveRootPath = (userPath: string) => {
  const rootPath = resolve(env.FS_ROOT ?? '');

  return resolve(rootPath, userPath);
};

export const resolveArchiveRootPath = () => {
  return resolve(env.ARCHIVE_ROOT ?? '');
};
