import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

const MAX_FILES = 400;
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Finds `node_modules/<module>` from `fromDir` up to `root` and returns its package.json and
 * type declaration files (paths relative to `root`).
 */
export const collectTypeFiles = async (
  root: string,
  fromDir: string,
  module: string,
): Promise<{ path: string; text: string }[]> => {
  let packageDir: string | undefined;
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', ...module.split('/'));
    if (existsSync(join(candidate, 'package.json'))) {
      packageDir = candidate;
      break;
    }
    if (dir === root || dirname(dir) === dir || relative(root, dir).startsWith('..')) break;
  }
  if (!packageDir || relative(root, packageDir).startsWith('..')) return [];

  const files: { path: string; text: string }[] = [];
  let bytes = 0;
  const add = async (file: string) => {
    if (files.length >= MAX_FILES || bytes > MAX_BYTES) return;
    const text = await readFile(file, 'utf8');
    bytes += text.length;
    files.push({ path: relative(root, file).split(sep).join('/'), text });
  };
  await add(join(packageDir, 'package.json'));
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (files.length >= MAX_FILES) return;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) await walk(path);
      } else if (/\.d\.[cm]?ts$/.test(entry.name) && (await stat(path)).size < 2 * 1024 * 1024) {
        await add(path);
      }
    }
  };
  await walk(packageDir);
  return files;
};
