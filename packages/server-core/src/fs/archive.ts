import { zip } from 'fflate';
import { readFile } from 'node:fs/promises';

import type { ProjectFileSystem } from './fs-service';

/** Zips a folder of the project (entries hidden by `.nfignore` stay out). */
export const archiveFolder = async (
  fs: ProjectFileSystem,
  path: string,
): Promise<Uint8Array<ArrayBuffer>> => {
  const entries = await fs.list(path, true);
  const files: Record<string, Uint8Array> = {};
  const prefix = path ? `${path}/` : '';
  for (const entry of entries) {
    if (entry.kind !== 'file') continue;
    files[entry.path.slice(prefix.length)] = new Uint8Array(
      await readFile(await fs.jail.resolve(entry.path)),
    );
  }
  return new Promise((resolve, reject) =>
    zip(files, { level: 6 }, (error, data) =>
      error ? reject(error) : resolve(data as Uint8Array<ArrayBuffer>),
    ),
  );
};
