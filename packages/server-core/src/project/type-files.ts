import { existsSync } from 'node:fs';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';

const MAX_FILES = 400;
const MAX_BYTES = 8 * 1024 * 1024;

const inside = (root: string, path: string) => {
  const rel = relative(root, path);
  return !rel.startsWith('..') && !isAbsolute(rel);
};

/**
 * Finds `node_modules/<module>` from `fromDir` up to `root` and returns its package.json and
 * type declaration files (paths relative to `root`). Links inside the package are never followed.
 * The package folder itself may be a link (pnpm, `link:` dependencies) unless `contained`: then
 * it must lead inside the project, so that a committed `node_modules/x -> /` reads nothing of
 * the host (hosted editors).
 */
export const collectTypeFiles = async (
  root: string,
  fromDir: string,
  module: string,
  options: { contained?: boolean } = {},
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
  if (options.contained && !inside(await realpath(root), await realpath(packageDir))) return [];

  const files: { path: string; text: string }[] = [];
  let bytes = 0;
  const add = async (file: string) => {
    if (files.length >= MAX_FILES || bytes > MAX_BYTES) return;
    if (!(await lstat(file)).isFile()) return;
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
      } else if (
        entry.isFile() &&
        /\.d\.[cm]?ts$/.test(entry.name) &&
        (await lstat(path)).size < 2 * 1024 * 1024
      ) {
        await add(path);
      }
    }
  };
  await walk(packageDir);
  return files;
};
