import {
  type ClientProject,
  type Disposable,
  type DocumentEditor,
  type FileEntry,
  type Observable,
  ObservableValue,
  basename,
  dirname,
  editorsFor,
  matchesGlob,
} from '@nanoforge-dev/editor-sdk';
import { FILE_ICONS, FILE_TEMPLATES, type FileTemplate } from '@nanoforge-dev/editor-sdk/ui';

import { isPackagePath } from '../filter/file-filter';
import type { Clipboard, FileManagerServiceOptions } from './file-manager-service.type';
import { FileOperations } from './file-operations';

export const NAME = /^[^/\\:*?"<>|]+$/;
export const validateName = (value: string) =>
  !value.trim()
    ? 'Enter a name'
    : !NAME.test(value) || value === '.' || value === '..'
      ? 'Names cannot contain / \\ : * ? " < > |'
      : undefined;

/**
 * State and actions of the file manager for the open project: selection, grid folder,
 * clipboard, pending deletes, and every operation of the context menu and shortcuts.
 */
export class FileManagerService implements Disposable {
  readonly operations: FileOperations;
  private readonly _selection = new ObservableValue<readonly string[]>([]);
  private readonly _folder = new ObservableValue<string>('');
  private readonly _clipboard = new ObservableValue<Clipboard | undefined>(undefined);
  private readonly _pendingDelete = new ObservableValue<readonly string[] | undefined>(undefined);

  constructor(private readonly _options: FileManagerServiceOptions) {
    this.operations = new FileOperations(_options.project, _options.history);
  }

  get project(): ClientProject {
    return this._options.project;
  }

  get local(): boolean {
    return this._options.local;
  }

  get selection(): Observable<readonly string[]> {
    return this._selection.readonly();
  }

  /** Folder shown by the grid. */
  get folder(): Observable<string> {
    return this._folder.readonly();
  }

  get clipboard(): Observable<Clipboard | undefined> {
    return this._clipboard.readonly();
  }

  /** Several entries or a folder waiting for a delete confirmation. */
  get pendingDelete(): Observable<readonly string[] | undefined> {
    return this._pendingDelete.readonly();
  }

  entry(path: string): FileEntry | undefined {
    return this._options.project.fs.entry(path);
  }

  select(paths: readonly string[]): void {
    this._selection.set(paths);
    const [first] = paths;
    if (first !== undefined) this._folder.set(this.targetFolder(first));
  }

  showFolder(path: string): void {
    this._folder.set(path);
  }

  /** Where new entries go for a target: the folder itself, or the file's folder. */
  targetFolder(path: string | undefined = this._selection.get()[0]): string {
    if (path === undefined) return this._folder.get();
    return this.entry(path)?.kind === 'directory' ? path : dirname(path);
  }

  readOnly(path: string): boolean {
    return isPackagePath(path);
  }

  templates(): FileTemplate[] {
    return this._options.extensions.getValues(FILE_TEMPLATES);
  }

  editorsOf(path: string): DocumentEditor[] {
    return editorsFor(this._options.extensions, path);
  }

  /** Icon of an entry: contributed icons (highest priority first), else a default. */
  iconOf(entry: Pick<FileEntry, 'path' | 'kind'>, expanded = false): string {
    if (entry.kind === 'directory') return expanded ? 'folder-open' : 'folder';
    const icon = this._options.extensions
      .getValues(FILE_ICONS)
      .filter((candidate) => matchesGlob(candidate.pattern, entry.path))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
    return icon?.icon ?? 'file';
  }

  open(path: string): Promise<unknown> {
    if (this.entry(path)?.kind === 'directory') {
      this.showFolder(path);
      return Promise.resolve();
    }
    return this._options.executeCommand('documents.open', path);
  }

  openWith(path: string, editor: DocumentEditor): Promise<unknown> {
    return editor.command
      ? this._options.executeCommand(editor.command, path)
      : this._options.executeCommand('workbench.openWidget', editor.widget);
  }

  async newFile(folder = this.targetFolder()): Promise<void> {
    const name = await this._ask('New file', 'File name', 'untitled.ts', folder);
    if (name)
      await this._run(async () => {
        const path = await this.operations.createFile(folder, name);
        this.select([path]);
        await this._options.executeCommand('documents.open', path, { line: 1 });
      });
  }

  async newFolder(folder = this.targetFolder()): Promise<void> {
    const name = await this._ask('New folder', 'Folder name', 'folder', folder);
    if (name) {
      await this._run(async () => this.select([await this.operations.createFolder(folder, name)]));
    }
  }

  async newFromTemplate(id: string, folder = this.targetFolder()): Promise<void> {
    const template = this.templates().find((candidate) => candidate.id === id);
    if (!template) return;
    const name = await this._ask(
      `New ${template.title.toLowerCase()}`,
      'Name',
      template.defaultName,
      folder,
    );
    if (!name) return;
    await this._run(async () => {
      const [main] = await this.operations.createFromTemplate(template, folder, name);
      if (main) {
        this.select([main]);
        await this.open(main);
      }
    });
  }

  async rename(path = this._selection.get()[0]): Promise<void> {
    if (path === undefined || this.readOnly(path)) return;
    const name = await this._options.prompts?.ask({
      title: `Rename ${basename(path)}`,
      label: 'New name',
      value: basename(path),
      confirm: 'Rename',
      validate: (value) =>
        validateName(value) ??
        (value !== basename(path) &&
        this.entry(`${dirname(path) ? `${dirname(path)}/` : ''}${value}`)
          ? `${value} already exists`
          : undefined),
    });
    if (name && name !== basename(path)) await this.renameTo(path, name);
  }

  /** Inline rename (tree). */
  async renameTo(path: string, name: string): Promise<boolean> {
    const invalid = validateName(name);
    if (invalid || this.readOnly(path)) {
      if (invalid) this._report(invalid);
      return false;
    }
    return this._run(async () => this.select([await this.operations.rename(path, name)]));
  }

  async move(paths: readonly string[], folder: string): Promise<void> {
    const movable = paths.filter((path) => !this.readOnly(path));
    if (!movable.length || this.readOnly(folder)) return;
    await this._run(async () => {
      const moved = await this.operations.move(movable, folder);
      if (moved.length) this.select(moved);
    });
  }

  copyToClipboard(mode: Clipboard['mode'], paths = this._selection.get()): void {
    const usable = mode === 'cut' ? paths.filter((path) => !this.readOnly(path)) : paths;
    if (usable.length) this._clipboard.set({ mode, paths: [...usable] });
  }

  async paste(folder = this.targetFolder()): Promise<void> {
    const clipboard = this._clipboard.get();
    if (!clipboard || this.readOnly(folder)) return;
    await this._run(async () => {
      const pasted =
        clipboard.mode === 'cut'
          ? await this.operations.move(clipboard.paths, folder)
          : await this.operations.copy(clipboard.paths, folder);
      if (clipboard.mode === 'cut') this._clipboard.set(undefined);
      if (pasted.length) this.select(pasted);
    });
  }

  async duplicate(paths = this._selection.get()): Promise<void> {
    const copies = paths.filter((path) => !this.readOnly(path));
    if (!copies.length) return;
    await this._run(async () => this.select(await this.operations.duplicate(copies)));
  }

  /** Deletes at once for one file; asks first for folders or several entries. */
  async delete(paths = this._selection.get()): Promise<void> {
    const targets = paths.filter((path) => !this.readOnly(path));
    if (!targets.length) return;
    const [only] = targets;
    if (targets.length === 1 && only !== undefined && this.entry(only)?.kind === 'file') {
      await this._run(() => this.operations.delete(targets));
    } else this._pendingDelete.set(targets);
  }

  async confirmDelete(confirmed: boolean): Promise<void> {
    const paths = this._pendingDelete.get();
    this._pendingDelete.set(undefined);
    if (confirmed && paths) await this._run(() => this.operations.delete(paths));
  }

  async importFiles(folder: string, files: readonly File[]): Promise<void> {
    if (!files.length) return;
    if (this.readOnly(folder)) {
      this._report('Installed packages (nf_modules) cannot be changed');
      return;
    }
    await this._run(async () => this.select(await this.operations.import(folder, files)));
  }

  /** Asks the computer for files to import into a folder. */
  pickFiles(folder = this.targetFolder()): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = () => void this.importFiles(folder, [...(input.files ?? [])]);
    input.click();
  }

  async reveal(path = this._selection.get()[0] ?? ''): Promise<void> {
    await this._run(() => this.project.fs.reveal(path));
  }

  /** URL of a project file (thumbnails, previews). */
  fileUrl(path: string, version?: number): string {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return `/files/${this.project.id}/${encoded}${version ? `?v=${Math.round(version)}` : ''}`;
  }

  /** Downloads a file, or a folder as .zip. */
  download(path = this._selection.get()[0] ?? ''): void {
    const link = document.createElement('a');
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    link.href = `/files/${this.project.id}/${encoded}?download`;
    link.download = '';
    document.body.append(link);
    link.click();
    link.remove();
  }

  async copyPath(path = this._selection.get()[0]): Promise<void> {
    if (path !== undefined) await navigator.clipboard?.writeText(path).catch(() => undefined);
  }

  dispose(): void {
    this._options.history.dispose();
  }

  private async _ask(title: string, label: string, value: string, folder: string) {
    if (this.readOnly(folder)) {
      this._report('Installed packages (nf_modules) cannot be changed');
      return undefined;
    }
    return this._options.prompts?.ask({
      title,
      label,
      value,
      confirm: 'Create',
      validate: (candidate) =>
        validateName(candidate) ??
        (this.entry(folder ? `${folder}/${candidate}` : candidate)
          ? `${candidate} already exists`
          : undefined),
    });
  }

  private async _run(task: () => Promise<unknown>): Promise<boolean> {
    try {
      await task();
      return true;
    } catch (error) {
      this._report(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private _report(message: string): void {
    this._options.logger.warn(message);
    this._options.notifications?.notify('error', message);
  }
}
