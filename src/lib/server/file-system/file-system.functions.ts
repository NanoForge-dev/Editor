import { join } from 'path';

import { env } from '$env/dynamic/private';

export const resolveRootPath = (userPath: string) => {
  const rootPath = join(process.cwd(), env.FS_ROOT ?? '');

  return join(rootPath, userPath);
};
