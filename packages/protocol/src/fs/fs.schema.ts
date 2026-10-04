import { z } from 'zod';

import { ProjectPath } from '../path/project-path';

/** Raw bytes (any Uint8Array, whatever its backing buffer). */
export const Bytes = z.custom<Uint8Array>((value) => value instanceof Uint8Array, 'expected bytes');

export const FileKind = z.enum(['file', 'directory']);

export const FileEntry = z.object({
  path: ProjectPath,
  kind: FileKind,
  size: z.number().int().nonnegative(),
  /** Modification time in ms since epoch. */
  mtime: z.number(),
});
export type FileEntry = z.output<typeof FileEntry>;

export const FileContent = FileEntry.extend({
  content: Bytes,
  /** sha1 of the content, used for optimistic concurrency on writes. */
  hash: z.string(),
});
export type FileContent = z.output<typeof FileContent>;

export const FileChange = z.object({
  type: z.enum(['created', 'changed', 'deleted']),
  path: ProjectPath,
  kind: FileKind,
});
export type FileChange = z.output<typeof FileChange>;
