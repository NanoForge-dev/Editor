import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** The package manager a project uses, from its lockfile. */
export const packageManagerOf = (root: string): string | undefined =>
  (
    [
      ['pnpm-lock.yaml', 'pnpm'],
      ['bun.lock', 'bun'],
      ['bun.lockb', 'bun'],
      ['yarn.lock', 'yarn'],
      ['package-lock.json', 'npm'],
    ] as const
  ).find(([lockfile]) => existsSync(join(root, lockfile)))?.[1];
