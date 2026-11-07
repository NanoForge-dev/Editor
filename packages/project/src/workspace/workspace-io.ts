import type { ClientProject } from '../service/client-project';
import type { WorkspaceIo } from './workspace.type';

/**
 * The files of an open project, as the workspace operations need them. Reads are fresh (from the
 * server) unless `fresh: false`: checks that only look read the browser's copies.
 */
export const workspaceIo = (
  project: ClientProject,
  { fresh = true }: { fresh?: boolean } = {},
): WorkspaceIo => ({
  exists: (path) => project.fs.entry(path) !== undefined,
  files: () =>
    project.fs.entries.filter((entry) => entry.kind === 'file').map((entry) => entry.path),
  read: async (path) => (await project.fs.readText(path, { fresh })).text,
  write: (path, text) => project.fs.write(path, text).then(() => undefined),
  remove: async (path) => {
    const { trashPath } = await project.fs.delete(path);
    return () => project.fs.restore(trashPath, path);
  },
  copy: (from, to) => project.fs.copy(from, to),
});
