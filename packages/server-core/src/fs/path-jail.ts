import { realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { RpcError } from '@nanoforge-dev/editor-rpc';

const isInside = (root: string, target: string) => {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

/** Closest existing ancestor's real path + the remaining (not yet existing) segments. */
const realpathLenient = async (target: string): Promise<string> => {
  const missing: string[] = [];
  let current = target;
  for (;;) {
    try {
      return join(await realpath(current), ...missing.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = dirname(current);
      if (parent === current) throw error;
      missing.push(current.slice(parent.length + 1));
      current = parent;
    }
  }
};

/**
 * Refuses a path by what it really points to (project-relative POSIX path, links followed):
 * returns the reason, or nothing to accept it.
 */
export type PathGuard = (real: string) => string | undefined;

/**
 * Resolves project-relative paths to absolute ones inside `root`, rejecting `..` escapes and
 * symlinks pointing outside of the project. `guard` also sees where a path really leads, so a
 * link inside the project cannot reach a folder the requested path does not name (`.git`).
 */
export class PathJail {
  private _realRoot: string | undefined;

  constructor(
    readonly root: string,
    private readonly _guard?: PathGuard,
  ) {}

  async resolve(path: string): Promise<string> {
    const target = resolve(this.root, path);
    if (!isInside(this.root, target)) throw this._escape(path);
    this._realRoot ??= await realpath(this.root);
    const real = await realpathLenient(target);
    if (!isInside(this._realRoot, real)) throw this._escape(path);
    const refused = this._guard?.(relative(this._realRoot, real).split(sep).join('/'));
    if (refused) throw new RpcError('FORBIDDEN', refused);
    return target;
  }

  /** Project-relative POSIX path of an absolute path inside the root. */
  relative(absolute: string): string {
    return relative(this.root, absolute).split(sep).join('/');
  }

  private _escape(path: string) {
    return new RpcError('FORBIDDEN', `Path escapes the project: ${path}`);
  }
}
