import { type ContextKeyService, basename } from '@nanoforge-dev/editor-sdk';
import { FILE_ACTIONS, type FileAction, type MenuEntry } from '@nanoforge-dev/editor-sdk/ui';

import type { FileManagerService } from '../service/file-manager-service';
import type { Contributions } from '../service/file-manager-service.type';

const extname = (path: string) => {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
};

const item = (
  id: string,
  label: string,
  onSelect: () => unknown,
  extra: { icon?: string; shortcut?: string; disabled?: boolean } = {},
): MenuEntry => ({ kind: 'item', id, label, onSelect: () => void onSelect(), ...extra });

const SEPARATOR: MenuEntry = { kind: 'separator' };

/** "New" entries: file, folder and the contributed templates by category. */
export const newEntries = (service: FileManagerService, folder: string): MenuEntry[] => {
  const templates = service.templates();
  const categories = [...new Set(templates.map((template) => template.category ?? ''))];
  return [
    item('new-file', 'File…', () => service.newFile(folder), { icon: 'file' }),
    item('new-folder', 'Folder…', () => service.newFolder(folder), { icon: 'folder' }),
    ...categories.flatMap((category) => [
      SEPARATOR,
      ...templates
        .filter((template) => (template.category ?? '') === category)
        .map((template) =>
          item(
            `template-${template.id}`,
            `${template.title}…`,
            () => service.newFromTemplate(template.id, folder),
            { ...(template.icon && { icon: template.icon }) },
          ),
        ),
    ]),
  ];
};

/**
 * Context menu of entries (empty `paths`: the project root). Contributed file actions are
 * filtered by their `when` clause over `fileKind`, `fileExtname`, `fileReadOnly` and
 * `fileSelectionCount`.
 */
export const fileMenu = (
  service: FileManagerService,
  paths: readonly string[],
  contextKeys: ContextKeyService,
  extensions: Contributions,
  executeCommand: (id: string, ...args: unknown[]) => Promise<unknown>,
): MenuEntry[] => {
  const [first] = paths;
  const entry = first !== undefined ? service.entry(first) : undefined;
  const folder = service.targetFolder(first ?? '');
  const readOnly = paths.some((path) => service.readOnly(path)) || service.readOnly(folder);
  const single = paths.length === 1 && first !== undefined;
  const entries: MenuEntry[] = [];

  if (single && entry?.kind === 'file') {
    entries.push(item('open', 'Open', () => service.open(first)));
    const editors = service.editorsOf(first);
    if (editors.length > 1) {
      entries.push({
        kind: 'submenu',
        label: 'Open with',
        items: editors.map((editor) =>
          item(`open-with-${editor.widget}`, editor.title ?? editor.widget, () =>
            service.openWith(first, editor),
          ),
        ),
      });
    }
    entries.push(SEPARATOR);
  }
  if (!readOnly) {
    entries.push({ kind: 'submenu', label: 'New', items: newEntries(service, folder) });
    entries.push(
      item('import', 'Import files…', () => executeCommand('fileManager.import', folder), {
        icon: 'upload',
      }),
    );
    entries.push(SEPARATOR);
  }
  if (paths.length) {
    entries.push(
      item('cut', 'Cut', () => service.copyToClipboard('cut', paths), {
        shortcut: 'Ctrl+X',
        disabled: readOnly,
      }),
      item('copy', 'Copy', () => service.copyToClipboard('copy', paths), { shortcut: 'Ctrl+C' }),
    );
  }
  entries.push(
    item('paste', 'Paste', () => service.paste(folder), {
      shortcut: 'Ctrl+V',
      disabled: readOnly || !service.clipboard.get(),
    }),
  );
  if (paths.length && !readOnly) {
    entries.push(
      item('duplicate', 'Duplicate', () => service.duplicate(paths), { shortcut: 'Ctrl+D' }),
      ...(single
        ? [item('rename', 'Rename…', () => service.rename(first), { shortcut: 'F2' })]
        : []),
      item('delete', 'Delete', () => service.delete(paths), { icon: 'trash-2', shortcut: 'Del' }),
    );
  }
  entries.push(SEPARATOR);
  if (single || !paths.length) {
    const target = first ?? '';
    if (service.local) {
      entries.push(item('reveal', 'Reveal in file manager', () => service.reveal(target)));
    }
    entries.push(
      item(
        'download',
        entry?.kind === 'file' ? 'Download' : 'Download as .zip',
        () => service.download(target),
        { icon: 'download' },
      ),
    );
    if (single) entries.push(item('copy-path', 'Copy path', () => service.copyPath(first)));
  }

  const scope = contextKeys.createScoped('file-manager.menu');
  scope.set('fileKind', entry?.kind ?? 'directory');
  scope.set('fileExtname', first !== undefined ? extname(first) : '');
  scope.set('fileReadOnly', readOnly);
  scope.set('fileSelectionCount', paths.length);
  const actions = extensions
    .getValues(FILE_ACTIONS)
    .filter((action) => scope.evaluate(action.when))
    .sort(
      (a, b) => (a.group ?? '').localeCompare(b.group ?? '') || (a.order ?? 0) - (b.order ?? 0),
    );
  scope.dispose();
  let group: string | undefined;
  for (const action of actions as FileAction[]) {
    if (action.group !== group) {
      entries.push(SEPARATOR);
      group = action.group;
    }
    entries.push(
      item(`action-${action.id}`, action.title, () => executeCommand(action.command, [...paths]), {
        ...(action.icon && { icon: action.icon }),
      }),
    );
  }

  return entries.filter(
    (entry, index, all) =>
      entry.kind !== 'separator' ||
      (index > 0 && index < all.length - 1 && all[index - 1]?.kind !== 'separator'),
  );
};
