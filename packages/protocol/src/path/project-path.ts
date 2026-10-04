import { z } from 'zod';

/**
 * A path relative to the project root, POSIX separators, no `.`/`..` segments, no leading
 * slash. The empty string is the root. The server still jails every path to the project.
 */
export const ProjectPath = z
  .string()
  .max(4096)
  .refine(
    (path) =>
      path === '' ||
      (!path.startsWith('/') &&
        !path.endsWith('/') &&
        !path.includes('\\') &&
        path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')),
    'must be a normalized project-relative path',
  );

export type ProjectPath = z.output<typeof ProjectPath>;

export const joinPath = (...parts: string[]): string =>
  parts
    .flatMap((part) => part.split('/'))
    .filter(Boolean)
    .join('/');

export const dirname = (path: string): string => path.split('/').slice(0, -1).join('/');

export const basename = (path: string): string => path.split('/').at(-1) ?? '';
