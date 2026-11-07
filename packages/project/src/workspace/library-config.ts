import type { AppModel } from '@nanoforge-dev/editor-protocol';

import { type Changes } from './changes';
import {
  configFile,
  editJson,
  packageJson,
  relativeTo,
  resolveFrom,
  setDependency,
} from './workspace-files';
import { WorkspaceError } from './workspace.exception';
import type { WorkspaceIo } from './workspace.type';

/**
 * The text of an app's `nanoforge.config` with a shared library added to its `libs` (paths
 * relative to the app, as the CLI writes them) or removed from it. Entries are compared by the
 * folder they point at. Undefined when the text has nowhere to put it (no `type` property).
 */
export const withConfigLibrary = (
  text: string,
  appRoot: string,
  libraryRoot: string,
  used: boolean,
): string | undefined => {
  const quote = /\btype\s*:\s*(["'])/.exec(text)?.[1] ?? '"';
  const literal = (value: string) => `${quote}${value}${quote}`;
  const property = /(\blibs\s*:\s*)\[([^\]]*)\]/.exec(text);
  if (property) {
    const entries = [...property[2]!.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map(
      (match) => match[2]!,
    );
    const others = entries.filter((entry) => resolveFrom(appRoot, entry) !== libraryRoot);
    if (used && others.length < entries.length) return text;
    const next = used ? [...others, relativeTo(appRoot, libraryRoot)] : others;
    if (next.length === entries.length && next.every((entry, index) => entry === entries[index]))
      return text;
    const start = property.index + property[1]!.length;
    const end = property.index + property[0].length;
    return `${text.slice(0, start)}[${next.map(literal).join(', ')}]${text.slice(end)}`;
  }
  if (!used) return text;
  const type = /(^[ \t]*)?\btype\s*:\s*(["'])[^"']*\2([ \t]*,)?/m.exec(text);
  if (!type) return undefined;
  const end = type.index + type[0].length;
  const entry = `libs: [${literal(relativeTo(appRoot, libraryRoot))}]`;
  const added =
    type[1] !== undefined
      ? `${type[3] ? '' : ','}\n${type[1]}${entry},`
      : type[3]
        ? ` ${entry},`
        : `, ${entry}`;
  return `${text.slice(0, end)}${added}${text.slice(end)}`;
};

/**
 * Makes an app use a library or stop: its config's `libs` (what the editor and the CLI read)
 * and its package.json dependency (what package managers read), kept in step. A library has no
 * `libs`: it uses others through its package.json only.
 */
export const setUse = async (
  io: WorkspaceIo,
  changes: Changes,
  app: Pick<AppModel, 'root' | 'type'>,
  library: Pick<AppModel, 'root' | 'name'>,
  used: boolean,
): Promise<void> => {
  await editJson(io, changes, packageJson(app), (json) => setDependency(json, library.name, used));
  if (app.type === 'lib') return;
  const file = configFile(io, app);
  if (!file) {
    if (used) throw new WorkspaceError(`${app.root || 'The app'} has no nanoforge.config.ts.`);
    return;
  }
  const text = await io.read(file);
  const edited = withConfigLibrary(text, app.root, library.root, used);
  if (edited === undefined)
    throw new WorkspaceError(
      `${file} could not be edited: add "${relativeTo(app.root, library.root)}" to its libs by hand.`,
      [file],
    );
  if (edited !== text) await changes.write(file, edited);
};
