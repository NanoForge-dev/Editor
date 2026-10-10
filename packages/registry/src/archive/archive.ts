import { strFromU8, unzipSync, zipSync } from 'fflate';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { ItemManifest, MANIFEST_FILE } from '../item/item.schema';
import { RegistryError } from '../registry/registry.exception';

export const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

/** Size of an archive, packed: a download past it is stopped. */
export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
/** What an archive may unpack to, in all and in files. */
const MAX_UNPACKED_BYTES = 256 * 1024 * 1024;
const MAX_FILES = 20_000;

/** A zip entry that would be written outside of the target folder, or in an odd place. */
const unsafe = (path: string): boolean =>
  path.startsWith('/') ||
  path.includes('\\') ||
  /^[A-Za-z]:/.test(path) ||
  path.split('/').some((segment) => segment === '..' || segment === '.');

/**
 * The files of an archive by path (folders left out); rejects unsafe paths, and archives that
 * unpack to more than 256 MiB or 20,000 files (checked on the sizes the entries claim, before
 * anything is allocated, then on what they gave).
 */
export const readArchive = (bytes: Uint8Array): Map<string, Uint8Array> => {
  if (bytes.length > MAX_ARCHIVE_BYTES) throw tooLarge();
  let entries: Record<string, Uint8Array>;
  let claimed = 0;
  let count = 0;
  try {
    entries = unzipSync(bytes, {
      filter: (file) => {
        claimed += file.originalSize;
        if (++count > MAX_FILES || claimed > MAX_UNPACKED_BYTES) throw tooLarge();
        return true;
      },
    });
  } catch (error) {
    if (error instanceof RegistryError) throw error;
    throw new RegistryError('INVALID', 'The archive is not a zip file');
  }
  const unpacked = Object.values(entries).reduce((total, content) => total + content.length, 0);
  if (unpacked > MAX_UNPACKED_BYTES) throw tooLarge();
  const files = new Map<string, Uint8Array>();
  for (const [path, content] of Object.entries(entries)) {
    if (path.endsWith('/')) continue;
    if (unsafe(path))
      throw new RegistryError('INVALID', `The archive holds an unsafe path: ${path}`);
    files.set(path, content);
  }
  return files;
};

const tooLarge = () =>
  new RegistryError('INVALID', 'The archive is too large (256 MiB or 20,000 files at most)');

/** The manifest at the root of an archive. */
export const manifestOf = (files: ReadonlyMap<string, Uint8Array>): ItemManifest => {
  const raw = files.get(MANIFEST_FILE);
  if (!raw) throw new RegistryError('INVALID', `The archive has no ${MANIFEST_FILE}`);
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(raw));
  } catch {
    throw new RegistryError('INVALID', `${MANIFEST_FILE} is not valid JSON`);
  }
  const parsed = ItemManifest.safeParse(json);
  if (!parsed.success) {
    throw new RegistryError(
      'INVALID',
      `${MANIFEST_FILE} is not valid: ${parsed.error.issues[0]?.message ?? 'unknown problem'}`,
    );
  }
  return parsed.data;
};

/**
 * Writes the files of an archive as a folder, replacing what was there. The manifest is written
 * last: a folder without it is an install that did not finish, and is installed again.
 *
 * Files are written in place rather than in a temporary folder renamed at the end: file
 * watchers (the editor's) miss the content of a folder that appears through a rename. The old
 * folder is moved aside first (`.nf-<hex>`, a name the editor's watcher skips) and put back when
 * the write fails (disk full), so a failed reinstall keeps the working copy.
 */
export const writeFolder = async (
  files: ReadonlyMap<string, Uint8Array>,
  target: string,
): Promise<void> => {
  const backup = `${target}.nf-${randomBytes(4).toString('hex')}`;
  const previous = existsSync(target);
  if (previous) await rename(target, backup);
  const ordered = [...files].sort(
    ([a], [b]) => Number(a === MANIFEST_FILE) - Number(b === MANIFEST_FILE),
  );
  try {
    for (const [path, content] of ordered) {
      const file = join(target, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, content);
    }
  } catch (error) {
    await rm(target, { recursive: true, force: true }).catch(() => undefined);
    if (previous) await rename(backup, target).catch(() => undefined);
    throw error;
  }
  if (previous) await rm(backup, { recursive: true, force: true }).catch(() => undefined);
};

/** Zips a folder with stable bytes (sorted paths, no dates), so its hash only follows its content. */
export const zipFolder = async (folder: string): Promise<Uint8Array> => {
  const files: Record<string, [Uint8Array, { mtime: Date }]> = {};
  const walk = async (dir: string, prefix: string) => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(dir, entry.name), path);
      else if (entry.isFile())
        files[path] = [await readFile(join(dir, entry.name)), { mtime: new Date(315532800000) }];
    }
  };
  await walk(folder, '');
  return zipSync(files, { level: 6 });
};
