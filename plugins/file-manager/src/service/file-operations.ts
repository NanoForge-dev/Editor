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

/** The entries of a selection that are not inside another selected entry. */
export const selectionRoots = (paths: readonly string[]): string[] =>
  paths.filter((path) => !paths.some((other) => other !== path && isInside(path, other)));

interface Step {
  do(): Promise<unknown>;
  undo(): Promise<unknown>;
}

/**
 * Runs steps in order, all or nothing: when one fails, those already done are undone (newest
 * first) and the error is rethrown, so a failed operation leaves no half-done change behind.
 */
export const runSteps = async (steps: readonly Step[]): Promise<void> => {
  const done: Step[] = [];
  try {
    for (const step of steps) {
      await step.do();
      done.push(step);
    }
  } catch (error) {
    for (const step of done.reverse()) await step.undo().catch(() => undefined);
    throw error;
  }
};

/** Undoes steps, newest first. */
const undoSteps = async (steps: readonly Step[]) => {
  for (const step of [...steps].reverse()) await step.undo();
};

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
    const steps = files.map((file, index) => ({
      do: () => this._fs.write(paths[index]!, file.content, { expectedHash: null }),
      undo: () => this._fs.delete(paths[index]!),
    }));
    await this._push({
      label: `Create ${template.title.toLowerCase()} ${name}`,
      do: () => runSteps(steps),
      undo: () => undoSteps(steps),
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
    const moves = selectionRoots(paths)
      .filter((path) => dirname(path) !== folder && !isInside(folder, path))
      .map((path) => [path, joinPath(folder, basename(path))] as const);
    for (const [, target] of moves) {
      if (this.exists(target)) throw new Error(`${target} already exists`);
    }
    if (!moves.length) return [];
    const steps = moves.map(([from, to]) => ({
      do: () => this._fs.rename(from, to),
      undo: () => this._fs.rename(to, from),
    }));
    await this._push({
      label: moves.length === 1 ? `Move ${basename(moves[0]![0])}` : `Move ${moves.length} items`,
      do: () => runSteps(steps),
      undo: () => undoSteps(steps),
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
    const steps = copies.map(([from, to]) => ({
      do: () => this._fs.copy(from, to),
      undo: () => this._fs.delete(to),
    }));
    await this._push({
      label:
        copies.length === 1 ? `Copy ${basename(copies[0]![0])}` : `Copy ${copies.length} items`,
      do: () => runSteps(steps),
      undo: () => undoSteps(steps),
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
    const roots = selectionRoots(paths);
    const steps = roots.map((path) => {
      let trashPath = '';
      return {
        do: async () => {
          ({ trashPath } = await this._fs.delete(path));
        },
        undo: () => this._fs.restore(trashPath, path),
      };
    });
    await this._push({
      label: roots.length === 1 ? `Delete ${basename(roots[0]!)}` : `Delete ${roots.length} items`,
      do: () => runSteps(steps),
      undo: () => undoSteps(steps),
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
    const steps = entries.map(({ path, content }) => ({
      do: () => this._fs.write(path, content, { expectedHash: null }),
      undo: () => this._fs.delete(path),
    }));
    await this._push({
      label:
        entries.length === 1
          ? `Import ${basename(entries[0]!.path)}`
          : `Import ${entries.length} files`,
      do: () => runSteps(steps),
      undo: () => undoSteps(steps),
    });
    return entries.map((entry) => entry.path);
  }

  private _push(command: HistoryCommand): Promise<void> {
    return this._history.stack.push(command);
  }
}
