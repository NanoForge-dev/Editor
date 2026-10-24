import { randomBytes } from 'node:crypto';
import { readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Folders set aside while packages change (`<folder>.nf-old-<id>`); swept when found later. */
const ASIDE = '.nf-';

/** Moves a folder out of the way, to put it back if the change fails. */
export const setAside = async (folder: string): Promise<string> => {
  const aside = `${folder}${ASIDE}old-${randomBytes(4).toString('hex')}`;
  await rename(folder, aside);
  return aside;
};

/** Removes the folders an interrupted change left set aside in `nf_modules`. */
export const sweepAside = async (modules: string): Promise<void> => {
  for (const scope of await readdir(modules).catch(() => [])) {
    for (const entry of await readdir(join(modules, scope)).catch(() => [])) {
      if (entry.includes(ASIDE))
        await rm(join(modules, scope, entry), { recursive: true, force: true });
    }
  }
};

/** Names of the packages present in `nf_modules`. */
export const installedNames = async (modules: string): Promise<string[]> => {
  const names: string[] = [];
  for (const scope of await readdir(modules).catch(() => [])) {
    if (!scope.startsWith('@')) continue;
    for (const entry of await readdir(join(modules, scope)).catch(() => [])) {
      if (!entry.includes(ASIDE)) names.push(`${scope}/${entry}`);
    }
  }
  return names;
};

/** Writes a whole file or nothing (a temporary file, then a rename). */
export const writeAtomically = async (path: string, text: string): Promise<void> => {
  const temp = `${path}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await writeFile(temp, text);
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
};
