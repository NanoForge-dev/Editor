import { AsyncZipDeflate, Zip, ZipDeflate } from 'fflate';
import { readFile } from 'node:fs/promises';

import { RpcError } from '@nanoforge-dev/editor-rpc';

import { PACKAGES_DIR, type ProjectFileSystem, TRASH_DIR } from './fs-service';

/** Bytes a folder may hold to be downloaded as a .zip (what its files add up to). */
export const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;

/** Left out of archives: deleted files, and installed packages (installed again from the lock). */
const LEFT_OUT = [TRASH_DIR, PACKAGES_DIR];
/** From this size on, a file is compressed in a worker (as fflate's `zip()` does). */
const ASYNC_FROM_BYTES = 160_000;

const leftOut = (path: string) =>
  LEFT_OUT.some((folder) => path === folder || path.startsWith(`${folder}/`));

/**
 * Zips a folder of the project as a stream: one file read at a time, as the reader asks for
 * more (the next once the last is zipped), so a large folder is never held in memory. A file
 * deleted since the folder was listed is left out. Entries hidden by `.nfignore`, the trash and
 * `nf_modules` stay out; a folder over `maxBytes` is refused (`PAYLOAD_TOO_LARGE`).
 */
export const archiveFolder = async (
  fs: ProjectFileSystem,
  path: string,
  maxBytes = MAX_ARCHIVE_BYTES,
): Promise<ReadableStream<Uint8Array>> => {
  const prefix = path ? `${path}/` : '';
  const files = (await fs.list(path, true)).filter(
    (entry) => entry.kind === 'file' && !leftOut(entry.path),
  );
  const total = files.reduce((sum, entry) => sum + entry.size, 0);
  if (total > maxBytes)
    throw new RpcError(
      'PAYLOAD_TOO_LARGE',
      `${path || 'The project'} holds ${Math.round(total / 1024 / 1024)} MiB: download a smaller folder`,
    );

  let next = 0;
  let zip: Zip | undefined;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      zip = new Zip((error, chunk, final) => {
        if (error) return controller.error(error);
        controller.enqueue(chunk);
        if (final) controller.close();
      });
    },
    async pull() {
      for (;;) {
        const entry = files[next++];
        if (!entry) {
          zip!.end();
          return;
        }
        let data: Uint8Array;
        try {
          data = new Uint8Array(await readFile(await fs.jail.resolve(entry.path)));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
          throw error;
        }
        const name = entry.path.slice(prefix.length);
        const file =
          data.length < ASYNC_FROM_BYTES
            ? new ZipDeflate(name, { level: 6 })
            : new AsyncZipDeflate(name, { level: 6 });
        zip!.add(file);
        const forward = file.ondata;
        await new Promise<void>((resolve) => {
          file.ondata = (error, chunk, final) => {
            forward(error, chunk, final);
            if (error || final) resolve();
          };
          file.push(data, true);
        });
        return;
      }
    },
    cancel() {
      zip?.terminate();
    },
  });
};
