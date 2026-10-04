import type { AppModel } from '@nanoforge-dev/editor-protocol';

/**
 * Changes of a project's workspace: its apps (clients, servers) and its shared libraries
 * (ADR 0004). Each operation edits the project's files through a small file interface and
 * resolves with what undoes it.
 *
 * An app **uses** a shared library when its `package.json` lists the library's package name in
 * `dependencies`: the meaning it has in any workspace.
 */

/** The files of the project, as the operations need them. */
export interface WorkspaceIo {
  exists(path: string): boolean;
  /** Paths of the project's files (what the editor lists: no `node_modules`). */
  files(): readonly string[];
  read(path: string): Promise<string>;
  /** Creates or replaces a file. */
  write(path: string, text: string): Promise<void>;
  /** Removes a file or folder; resolves with what brings it back. */
  remove(path: string): Promise<() => Promise<void>>;
  /** Copies a file or a folder with everything in it. */
  copy(from: string, to: string): Promise<void>;
}

export type Undo = () => Promise<void>;

export interface NewLibrary {
  /** Folder in `libs/`. */
  readonly folder: string;
  /** How apps import it: `@my-game/shared`. */
  readonly packageName: string;
  /** The apps (and libraries) that use it from the start. */
  readonly usedBy: readonly Pick<AppModel, 'root' | 'type'>[];
}

export interface NewApp {
  readonly type: 'client' | 'server';
  /** Folder in `apps/`. */
  readonly folder: string;
  /** Package name of the app. */
  readonly name: string;
  /** An app of the same type to copy; an empty app without it. */
  readonly from?: AppModel;
}
