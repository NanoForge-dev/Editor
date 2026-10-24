import { z } from 'zod';

import { defineContract } from '@nanoforge-dev/editor-rpc';

import { ProjectPath } from '../path/project-path';
import { ProjectId } from '../project/project.schema';
import { Bytes, FileChange, FileContent, FileEntry } from './fs.schema';

const Target = z.object({ project: ProjectId, path: ProjectPath });

export const FsContract = defineContract('fs', {
  methods: {
    stat: { input: Target, output: FileEntry.nullable() },
    list: {
      input: Target.extend({ recursive: z.boolean().default(false) }),
      output: z.array(FileEntry),
    },
    read: { input: Target, output: FileContent },
    write: {
      input: Target.extend({
        content: z.union([Bytes, z.string()]),
        /** Fails with CONFLICT when the file changed since this hash was read. */
        expectedHash: z.string().nullable().optional(),
        createParents: z.boolean().default(true),
      }),
      output: FileEntry.extend({ hash: z.string() }),
    },
    mkdir: { input: Target, output: FileEntry },
    rename: {
      input: z.object({
        project: ProjectId,
        from: ProjectPath,
        to: ProjectPath,
        overwrite: z.boolean().default(false),
      }),
      output: FileEntry,
    },
    copy: {
      input: z.object({
        project: ProjectId,
        from: ProjectPath,
        to: ProjectPath,
        overwrite: z.boolean().default(false),
      }),
      output: FileEntry,
    },
    /** Moves the entry to `.nanoforge/editor/trash`; `trashPath` brings it back (`restore`). */
    delete: { input: Target, output: z.object({ trashPath: ProjectPath }) },
    /** Undo of `delete`: moves the entry back from the trash to `path`. */
    restore: {
      input: z.object({ project: ProjectId, trashPath: ProjectPath, path: ProjectPath }),
      output: FileEntry,
    },
    /** Local editors: shows the entry in the OS file manager. */
    reveal: { input: Target, output: z.null() },
  },
  streams: {
    /** Batched changes in the project (node_modules, .git and build outputs are ignored). */
    changes: {
      params: z.object({ project: ProjectId }),
      event: z.object({ changes: z.array(FileChange) }),
    },
  },
});
