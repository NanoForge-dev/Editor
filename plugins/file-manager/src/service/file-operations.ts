import {
  type ClientProject,
  type HistoryCommand,
  type HistoryContext,
  basename,
  dirname,
  joinPath,
} from '@nanoforge-dev/editor-sdk';
import type { FileTemplate } from '@nanoforge-dev/editor-sdk/ui';

/** Splits `name.ext` (dotfiles and folders have no extension). */
const splitName = (name: string): [string, string] => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
};

/** A free name in a folder: `name`, else `name copy`, `name copy 2`… */
export const freeName = (
  exists: (path: string) => boolean,
  folder: string,
  name: string,
  suffix = ' copy',
): string => {
  if (!exists(joinPath(folder, name))) return name;
  const [stem, extension] = splitName(name);
  for (let index = 1; ; index++) {
    const candidate = `${stem}${suffix}${index > 1 ? ` ${index}` : ''}${extension}`;
    if (!exists(joinPath(folder, candidate))) return candidate;
  }
};

/** Whether `path` is `folder` or inside it. */
export const isInside = (path: string, folder: string): boolean =>
  folder === '' || path === folder || path.startsWith(`${folder}/`);

/**
 * File operations of the file manager, each one an undo step of its history context:
 * create, rename, move, copy, duplicate, delete (to the trash), import.
 */
export class FileOperations {
  constructor(
    private readonly _project: ClientProject,
    private readonly _history: HistoryContext,
  ) {}

  private get _fs() {
    return this._project.fs;
  }

  exists = (path: string): boolean => !!this._fs.entry(path);

  async createFile(
    folder: string,
    name: string,
    content: string | Uint8Array = '',
  ): Promise<string> {
    const path = joinPath(folder, name);
    await this._push({
      label: `Create ${name}`,
      do: async () => {
        await this._fs.write(path, content, { expectedHash: null });
      },
      undo: async () => {
        await this._fs.delete(path);
      },
    });
    return path;
  }

  async createFolder(folder: string, name: string): Promise<string> {
    const path = joinPath(folder, name);
    await this._push({
      label: `Create folder ${name}`,
      do: () => this._fs.mkdir(path),
      undo: async () => {
        await this._fs.delete(path);
      },
    });
    return path;
  }

  /** Creates the files of a template; resolves with their paths (the first is the main one). */
  async createFromTemplate(
    template: FileTemplate,
    folder: string,
    name: string,
  ): Promise<string[]> {
    const files = await template.create({ folder, name });
    const paths = files.map((file) => joinPath(folder, file.path));
    for (const path of paths) {
      if (this.exists(path)) throw new Error(`${path} already exists`);
    }
    await this._push({
      label: `Create ${template.title.toLowerCase()} ${name}`,
      do: async () => {
        for (const [index, file] of files.entries()) {
          await this._fs.write(paths[index]!, file.content, { expectedHash: null });
        }
      },
      undo: async () => {
        for (const path of [...paths].reverse()) await this._fs.delete(path);
      },
    });
    return paths;
  }

  async rename(path: string, name: string): Promise<string> {
    const target = joinPath(dirname(path), name);
    if (target === path) return path;
    await this._push({
      label: `Rename ${basename(path)} to ${name}`,
      do: () => this._fs.rename(path, target),
      undo: () => this._fs.rename(target, path),
    });
    return target;
  }

  /** Moves entries into a folder (entries already there, or the folder itself, are skipped). */
  async move(paths: readonly string[], folder: string): Promise<string[]> {
    const moves = paths
      .filter((path) => dirname(path) !== folder && !isInside(folder, path))
      .map((path) => [path, joinPath(folder, basename(path))] as const);
    for (const [, target] of moves) {
      if (this.exists(target)) throw new Error(`${target} already exists`);
    }
    if (!moves.length) return [];
    await this._push({
      label: moves.length === 1 ? `Move ${basename(moves[0]![0])}` : `Move ${moves.length} items`,
      do: async () => {
        for (const [from, to] of moves) await this._fs.rename(from, to);
      },
      undo: async () => {
        for (const [from, to] of [...moves].reverse()) await this._fs.rename(to, from);
      },
    });
    return moves.map(([, to]) => to);
  }

  /** Copies entries into a folder, under free names. */
  async copy(paths: readonly string[], folder: string, suffix?: string): Promise<string[]> {
    const taken = new Set<string>();
    const copies = paths.map((path) => {
      const name = freeName(
        (candidate) => this.exists(candidate) || taken.has(candidate),
        folder,
        basename(path),
        suffix,
      );
      const target = joinPath(folder, name);
      taken.add(target);
      return [path, target] as const;
    });
    if (!copies.length) return [];
    await this._push({
      label:
        copies.length === 1 ? `Copy ${basename(copies[0]![0])}` : `Copy ${copies.length} items`,
      do: async () => {
        for (const [from, to] of copies) await this._fs.copy(from, to);
      },
      undo: async () => {
        for (const [, to] of [...copies].reverse()) await this._fs.delete(to);
      },
    });
    return copies.map(([, to]) => to);
  }

  duplicate(paths: readonly string[]): Promise<string[]> {
    return Promise.all(paths.map((path) => this.copy([path], dirname(path)))).then((all) =>
      all.flat(),
    );
  }

  /** Moves entries to the project trash; undo brings them back. */
  async delete(paths: readonly string[]): Promise<void> {
    const roots = paths.filter(
      (path) => !paths.some((other) => other !== path && isInside(path, other)),
    );
    let trashed: { path: string; trashPath: string }[] = [];
    await this._push({
      label: roots.length === 1 ? `Delete ${basename(roots[0]!)}` : `Delete ${roots.length} items`,
      do: async () => {
        trashed = [];
        for (const path of roots) trashed.push({ path, ...(await this._fs.delete(path)) });
      },
      undo: async () => {
        for (const { path, trashPath } of [...trashed].reverse()) {
          await this._fs.restore(trashPath, path);
        }
      },
    });
  }

  /** Imports files from the computer into a folder (free names when they exist). */
  async import(folder: string, files: readonly File[]): Promise<string[]> {
    const taken = new Set<string>();
    const entries = await Promise.all(
      files.map(async (file) => {
        const name = freeName(
          (candidate) => this.exists(candidate) || taken.has(candidate),
          folder,
          file.name,
        );
        const path = joinPath(folder, name);
        taken.add(path);
        return { path, content: new Uint8Array(await file.arrayBuffer()) };
      }),
    );
    if (!entries.length) return [];
    await this._push({
      label:
        entries.length === 1
          ? `Import ${basename(entries[0]!.path)}`
          : `Import ${entries.length} files`,
      do: async () => {
        for (const { path, content } of entries) {
          await this._fs.write(path, content, { expectedHash: null });
        }
      },
      undo: async () => {
        for (const { path } of [...entries].reverse()) await this._fs.delete(path);
      },
    });
    return entries.map((entry) => entry.path);
  }

  private _push(command: HistoryCommand): Promise<void> {
    return this._history.stack.push(command);
  }
}
