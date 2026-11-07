import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PREFIX = 'NANOFORGE_';
const CLIENT_PREFIX = `${PREFIX}CLIENT_`;
const SERVER_PREFIX = `${PREFIX}SERVER_`;

/** Parses a `.env` file: `KEY=value`, `export KEY=value`, quotes, `#` comments. */
export const parseDotenv = (text: string): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)?\s*$/.exec(raw);
    if (!match) continue;
    let value = (match[2] ?? '').trim();
    const quote = value[0];
    if (
      (quote === '"' || quote === "'" || quote === '`') &&
      value.endsWith(quote) &&
      value.length > 1
    ) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    values[match[1]!] = value;
  }
  return values;
};

export interface GameEnv {
  readonly client: Record<string, string>;
  readonly server: Record<string, string>;
}

/**
 * Splits `NANOFORGE_*` variables between the client and the server and strips the prefixes, as
 * `nf start` and the loaders do: `NANOFORGE_CLIENT_X` → client `X`, `NANOFORGE_SERVER_X` →
 * server `X`, `NANOFORGE_X` → both.
 */
export const splitGameEnv = (raw: Record<string, string | undefined>): GameEnv => {
  const client: Record<string, string> = {};
  const server: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith(PREFIX) || !value) continue;
    if (key.startsWith(CLIENT_PREFIX)) client[key.slice(CLIENT_PREFIX.length)] = value;
    else if (key.startsWith(SERVER_PREFIX)) server[key.slice(SERVER_PREFIX.length)] = value;
    else {
      client[key.slice(PREFIX.length)] ??= value;
      server[key.slice(PREFIX.length)] ??= value;
    }
  }
  return { client, server };
};

/**
 * Environment of a game app: the editor's own `NANOFORGE_*` variables, then the project's
 * `.env`, then the overrides (`runtime.env` setting), split for the app's side.
 */
export const loadGameEnv = async (
  projectRoot: string,
  side: 'client' | 'server',
  overrides: Record<string, string> = {},
  processEnv: Record<string, string | undefined> = process.env,
): Promise<Record<string, string>> => {
  const dotenv = await readFile(join(projectRoot, '.env'), 'utf8').then(parseDotenv, () => ({}));
  return splitGameEnv({ ...processEnv, ...dotenv, ...overrides })[side];
};
