import ignore, { type Ignore } from 'ignore';

import { type FileEntry, basename } from '@nanoforge-dev/editor-sdk';

/** Folder of installed bundles, shown apart and read-only. */
export const PACKAGES = 'nf_modules';

export const isPackagePath = (path: string): boolean =>
  path === PACKAGES || path.startsWith(`${PACKAGES}/`);

/** `fileManager.exclude`: gitignore patterns hidden in the file manager. */
export class FileFilter {
  private readonly _rules: Ignore;

  constructor(patterns: readonly string[]) {
    this._rules = ignore().add([...patterns]);
  }

  excludes(entry: Pick<FileEntry, 'path' | 'kind'>): boolean {
    const path = entry.kind === 'directory' ? `${entry.path}/` : entry.path;
    return this._rules.ignores(path);
  }
}

/**
 * Fuzzy match of a query on a file name: every query character in order, case-insensitive.
 * Returns a score (higher is better: consecutive and early matches) or -1.
 */
export const fuzzyScore = (query: string, path: string): number => {
  const name = basename(path).toLowerCase();
  const needle = query.toLowerCase();
  if (!needle) return 0;
  let score = 0;
  let from = 0;
  let previous = -2;
  for (const char of needle) {
    const index = name.indexOf(char, from);
    if (index < 0) return -1;
    score += index === previous + 1 ? 3 : 1;
    if (index === 0) score += 2;
    previous = index;
    from = index + 1;
  }
  return score - name.length / 100;
};
