import { env } from '$env/dynamic/private';

const PREFIX_CLIENT = 'NANOFORGE_CLIENT_';
const PREFIX_SERVER = 'NANOFORGE_SERVER_';
const PREFIX = 'NANOFORGE_';

export const getGameEnv = (side: 'client' | 'server'): { [key: string]: string | undefined } => {
  return Object.fromEntries(
    Object.entries(env)
      .map(([key, value]) => {
        if (side === 'server' && key.startsWith(PREFIX_SERVER)) {
          return [key.slice(PREFIX_SERVER.length), value];
        } else if (side === 'client' && key.startsWith(PREFIX_CLIENT)) {
          return [key.slice(PREFIX_CLIENT.length), value];
        } else if (key.startsWith(PREFIX)) {
          return [key.slice(PREFIX.length), value];
        }
        return undefined;
      })
      .filter((e) => e !== undefined),
  );
};
