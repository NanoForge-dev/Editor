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
 * Resolves project-relative paths to absolute ones inside `root`, rejecting `..` escapes and
 * symlinks pointing outside of the project.
 */
export class PathJail {
  private _realRoot: string | undefined;

  constructor(readonly root: string) {}

  async resolve(path: string): Promise<string> {
    const target = resolve(this.root, path);
    if (!isInside(this.root, target)) throw this._escape(path);
    this._realRoot ??= await realpath(this.root);
    if (!isInside(this._realRoot, await realpathLenient(target))) throw this._escape(path);
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
