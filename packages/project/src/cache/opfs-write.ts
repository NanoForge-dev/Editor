/**
 * Writes a file of the origin private file system. `createWritable` is missing in some browsers
 * (Safari); there, a worker writes with `createSyncAccessHandle`, which only workers have.
 */
export const writeOpfsFile = async (
  path: readonly string[],
  bytes: Uint8Array,
  /** Tests: writes through the worker even where `createWritable` exists. */
  options: { readonly viaWorker?: boolean } = {},
): Promise<void> => {
  const handle = await fileHandle(path);
  if (
    !options.viaWorker &&
    'createWritable' in handle &&
    typeof handle.createWritable === 'function'
  ) {
    const writable = await handle.createWritable();
    try {
      await writable.write(bytes as Uint8Array<ArrayBuffer>);
    } finally {
      await writable.close();
    }
    return;
  }
  await writeInWorker(path, bytes);
};

/** Whether files can be written here: `createWritable`, or workers for the fallback. */
export const canWriteOpfs = (): boolean =>
  typeof FileSystemFileHandle !== 'undefined' &&
  ('createWritable' in FileSystemFileHandle.prototype || typeof Worker !== 'undefined');

const fileHandle = async (path: readonly string[]): Promise<FileSystemFileHandle> => {
  let dir = await navigator.storage.getDirectory();
  for (const part of path.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
  return dir.getFileHandle(path.at(-1)!, { create: true });
};

const WORKER_SOURCE = `
onmessage = async ({ data: { id, path, bytes } }) => {
  try {
    let dir = await navigator.storage.getDirectory();
    for (const part of path.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
    const handle = await dir.getFileHandle(path[path.length - 1], { create: true });
    const access = await handle.createSyncAccessHandle();
    try {
      access.truncate(0);
      access.write(bytes, { at: 0 });
      access.flush();
    } finally {
      access.close();
    }
    postMessage({ id, ok: true });
  } catch (error) {
    postMessage({ id, ok: false, name: error && error.name, message: String(error) });
  }
};
`;

let worker: Worker | undefined;
let nextId = 0;
const waiting = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();

const writeInWorker = (path: readonly string[], bytes: Uint8Array): Promise<void> => {
  if (!worker) {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = ({
      data,
    }: MessageEvent<{ id: number; ok: boolean; name?: string; message?: string }>) => {
      const pending = waiting.get(data.id);
      waiting.delete(data.id);
      if (data.ok) pending?.resolve();
      else
        pending?.reject(
          Object.assign(new Error(data.message ?? 'OPFS write failed'), {
            name: data.name ?? 'Error',
          }),
        );
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    worker!.postMessage({ id, path: [...path], bytes });
  });
};
