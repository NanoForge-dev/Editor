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
  /**
   * sha1 of a file's content (files the server can read: 64 MiB at most). A client trusts its
   * cached copy of the content when the hashes match, whatever the modification time says.
   */
  hash: z.string().optional(),
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

/** One file asked for by `readMany`, with the hash of the copy the client already has. */
export const ReadRequest = z.object({ path: ProjectPath, knownHash: z.string().optional() });
export type ReadRequest = z.output<typeof ReadRequest>;

/**
 * One answer of `readMany`: the content, or `notModified` when the client's copy is current
 * (no bytes sent), or why the file could not be read.
 */
export const ReadResult = z.union([
  FileContent,
  FileEntry.extend({ notModified: z.literal(true), hash: z.string() }),
  z.object({
    path: ProjectPath,
    error: z.object({ code: z.string(), message: z.string() }),
  }),
]);
export type ReadResult = z.output<typeof ReadResult>;
