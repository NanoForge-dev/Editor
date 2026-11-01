import { Changes } from './changes';
import { WorkspaceError } from './workspace.exception';
import type { Undo, WorkspaceIo } from './workspace.type';

/** A file a changeset writes or removes: no `before`, it is created; no `after`, it goes. */
export interface ChangesetFile {
  readonly path: string;
  readonly before?: string;
  readonly after?: string;
}

/** What an operation would change, to show before it is made (project adoption, ADR 0003). */
export interface Changeset {
  readonly title: string;
  /** In the order they are written: what makes the change visible comes last. */
  readonly files: readonly ChangesetFile[];
  /** What the preview should say besides the files (a dependency not on npm yet…). */
  readonly notes?: readonly string[];
}

/**
 * Runs a workspace operation on the project's files kept in memory, and returns what it would
 * change, nothing written. A file written twice takes the place of its last write.
 */
export const recordChanges = async (
  base: WorkspaceIo,
  title: string,
  operation: (io: WorkspaceIo) => Promise<unknown>,
): Promise<Changeset> => {
  /** Path → new text, or null once removed; insertion order is the write order. */
  const overlay = new Map<string, string | null>();
  const touch = (path: string, text: string | null) => {
    overlay.delete(path);
    overlay.set(path, text);
  };
  const exists = (path: string) =>
    overlay.has(path) ? overlay.get(path) !== null : base.exists(path);
  const files = () => [
    ...base.files().filter((path) => !overlay.has(path)),
    ...[...overlay].filter(([, text]) => text !== null).map(([path]) => path),
  ];
  const under = (folder: string) =>
    files().filter((path) => path === folder || path.startsWith(`${folder}/`));
  const read = async (path: string) => {
    const text = overlay.get(path);
    if (text === null) throw new WorkspaceError(`${path} does not exist.`, [path]);
    return text ?? base.read(path);
  };
  const io: WorkspaceIo = {
    exists,
    files,
    read,
    write: async (path, text) => touch(path, text),
    remove: async (path) => {
      for (const file of under(path)) touch(file, null);
      return async () => undefined;
    },
    copy: async (from, to) => {
      for (const file of under(from)) touch(`${to}${file.slice(from.length)}`, await read(file));
    },
  };
  await operation(io);
  const changes: ChangesetFile[] = [];
  for (const [path, after] of overlay) {
    const before = base.exists(path) ? await base.read(path) : undefined;
    if (before === (after ?? undefined)) continue;
    changes.push({
      path,
      ...(before !== undefined && { before }),
      ...(after !== null && { after }),
    });
  }
  return { title, files: changes };
};

/**
 * Makes a changeset's changes, in its order, and resolves with their undo. Nothing is written when
 * a file is no longer what the preview showed.
 */
export const applyChangeset = (io: WorkspaceIo, changeset: Changeset): Promise<Undo> => {
  const changes = new Changes(io);
  return changes.run(async () => {
    const stale: string[] = [];
    for (const file of changeset.files) {
      const current = io.exists(file.path) ? await io.read(file.path) : undefined;
      if (current !== file.before) stale.push(file.path);
    }
    if (stale.length)
      throw new WorkspaceError(
        'These files changed since the preview: look at the changes again.',
        stale,
      );
    /** Folders the new files bring (the topmost missing one of each): undo removes them too. */
    const folders = new Set<string>();
    for (const file of changeset.files) {
      if (file.before !== undefined) continue;
      const parts = file.path.split('/').slice(0, -1);
      for (let depth = 1; depth <= parts.length; depth++) {
        const folder = parts.slice(0, depth).join('/');
        if (io.exists(folder)) continue;
        if (![...folders].some((known) => folder.startsWith(`${known}/`))) folders.add(folder);
        break;
      }
    }
    for (const file of changeset.files) {
      if (file.after === undefined) await changes.remove(file.path);
      else await changes.write(file.path, file.after);
    }
    for (const folder of folders) changes.created(folder);
  });
};
