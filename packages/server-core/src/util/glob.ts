import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const IGNORED = new Set(['node_modules', '.git', '.nanoforge', 'dist']);

/**
 * Whether `name` matches a segment pattern where `*` is any run of characters. Linear in time
 * (the patterns come from the project's config: a regex of `a*a*a*b` backtracks).
 */
export const matchSegment = (pattern: string, name: string): boolean => {
  let p = 0;
  let n = 0;
  let star = -1;
  let resume = 0;
  while (n < name.length) {
    if (p < pattern.length && pattern[p] !== '*' && pattern[p] === name[n]) {
      p++;
      n++;
    } else if (p < pattern.length && pattern[p] === '*') {
      star = p++;
      resume = n;
    } else if (star >= 0) {
      p = star + 1;
      n = ++resume;
    } else {
      return false;
    }
  }
  while (pattern[p] === '*') p++;
  return p === pattern.length;
};

/**
 * Expands workspace `packages` patterns (`apps/*`, `packages/**`, `libs/shared`) into
 * directories relative to `root`. Only directories are matched.
 */
export const expandDirectoryGlobs = async (
  root: string,
  patterns: readonly string[],
): Promise<string[]> => {
  const results = new Set<string>();
  const walk = async (relative: string, segments: string[]): Promise<void> => {
    if (!segments.length) {
      results.add(relative);
      return;
    }
    const [segment, ...rest] = segments as [string, ...string[]];
    if (segment === '**') {
      await walk(relative, rest);
      for (const child of await children(root, relative))
        await walk(join(relative, child), segments);
      return;
    }
    if (!segment.includes('*')) {
      if ((await children(root, relative)).includes(segment))
        await walk(join(relative, segment), rest);
      return;
    }
    for (const child of await children(root, relative)) {
      if (matchSegment(segment, child)) await walk(join(relative, child), rest);
    }
  };
  for (const pattern of patterns) {
    await walk(
      '',
      pattern.split('/').filter((segment) => segment && segment !== '.'),
    );
  }
  return [...results].map((path) => path.split('\\').join('/')).sort();
};

const children = async (root: string, relative: string): Promise<string[]> => {
  try {
    const entries = await readdir(join(root, relative), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !IGNORED.has(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};
