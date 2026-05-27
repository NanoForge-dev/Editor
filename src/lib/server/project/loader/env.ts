import { config } from 'dotenv';
import { resolve } from 'path';

import type { Part } from '@utils/types';

const PREFIX_CLIENT = 'NANOFORGE_CLIENT_';
const PREFIX_SERVER = 'NANOFORGE_SERVER_';
const PREFIX = 'NANOFORGE_';

const loadEnv = (path: string): Record<string, string> => {
  const env = {};
  config({ path, processEnv: env });
  return env;
};

const parseEnv = (part: Part, env: Record<string, string>): Record<string, string> => {
  const partPrefix = part === 'client' ? PREFIX_CLIENT : PREFIX_SERVER;
  return Object.fromEntries(
    Object.entries(env)
      .filter(
        ([key]) =>
          key.startsWith(PREFIX) &&
          ((part === 'client' && !key.startsWith(PREFIX_SERVER)) ||
            (part === 'server' && !key.startsWith(PREFIX_CLIENT))),
      )
      .map(([key, value]) => [key.replace(new RegExp(`^${partPrefix}|${PREFIX}`), ''), value]),
  );
};

export const resolveEnv = (part: Part, projectPath: string) => {
  return parseEnv(part, loadEnv(resolve(projectPath, '.env')));
};
