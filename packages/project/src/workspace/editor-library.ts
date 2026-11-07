import type { AppModel } from '@nanoforge-dev/editor-protocol';

import { Changes } from './changes';
import { editJson, packageJson } from './workspace-files';
import { EDITOR_LIBRARY } from './workspace.const';
import { WorkspaceError } from './workspace.exception';
import type { Undo, WorkspaceIo } from './workspace.type';

/**
 * The text of an entry file with `EditorLibrary` registered after its last `app.use(...)`.
 * Undefined when it already is, or when the file registers no library to put it after.
 */
export const withEditorLibrary = (text: string): string | undefined => {
  if (/\bEditorLibrary\b/.test(text)) return undefined;
  const last = [...text.matchAll(/^([ \t]*)(\w+)\.use\(.*\);[ \t]*$/gm)].at(-1);
  if (!last) return undefined;
  const end = last.index + last[0].length;
  const imports = [
    ...text.matchAll(/^import [^;]*?from\s*["']@nanoforge-dev\/[^"']+["'];?[ \t]*$/gm),
  ];
  const after = imports.at(-1);
  const line = `import { EditorLibrary } from "${EDITOR_LIBRARY}";`;
  const used = `${text.slice(0, end)}\n${last[1]}${last[2]}.use(new EditorLibrary());${text.slice(end)}`;
  if (!after) return `${line}\n${used}`;
  const at = after.index + after[0].length;
  return `${used.slice(0, at)}\n${line}${used.slice(at)}`;
};

/**
 * Makes an app drivable by the editor: `@nanoforge-dev/editor-lib` next to its other engine
 * libraries (at the version of `@nanoforge-dev/core`), and `EditorLibrary` registered in its
 * entry file. Refused when the entry file already registers it.
 */
export const addEditorLibrary = (io: WorkspaceIo, app: AppModel): Promise<Undo> => {
  const changes = new Changes(io);
  return changes.run(async () => {
    if (!app.entryFile || !io.exists(app.entryFile))
      throw new WorkspaceError(`${app.name} has no entry file.`);
    const main = await io.read(app.entryFile);
    if (/\bEditorLibrary\b/.test(main))
      throw new WorkspaceError(
        `${app.entryFile} already registers the editor library: update the NanoForge engine packages of the project.`,
      );
    const edited = withEditorLibrary(main);
    if (!edited)
      throw new WorkspaceError(
        `${app.entryFile} registers no library with app.use(…): add app.use(new EditorLibrary()) by hand, from ${EDITOR_LIBRARY}.`,
      );
    await editJson(io, changes, packageJson(app), (json) => {
      const sections = ['dependencies', 'devDependencies'] as const;
      if (sections.some((key) => EDITOR_LIBRARY in ((json[key] ?? {}) as object))) return;
      const key =
        sections.find((section) => '@nanoforge-dev/core' in ((json[section] ?? {}) as object)) ??
        'dependencies';
      const entries = (json[key] ?? {}) as Record<string, string>;
      json[key] = Object.fromEntries(
        Object.entries({
          ...entries,
          [EDITOR_LIBRARY]: entries['@nanoforge-dev/core'] ?? '*',
        }).sort(([a], [b]) => a.localeCompare(b)),
      );
    });
    await changes.write(app.entryFile, edited);
  });
};
