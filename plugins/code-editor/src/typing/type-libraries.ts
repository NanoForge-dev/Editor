import type { ClientProject, CodeService, Disposable } from '@nanoforge-dev/editor-sdk';

import type { Monaco } from '../monaco/monaco';

const CODE = /\.(?:[cm]?[jt]sx?|d\.ts)$/;
const IGNORED = /(?:^|\/)(?:node_modules|dist|\.nanoforge)\//;
const BARE_IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"./][^'"]*)['"]/g;

/** Package name of a bare import (`@scope/name/sub` → `@scope/name`). */
export const packageOf = (specifier: string): string => {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!;
};

/** Bare imports of a source text. */
export const bareImports = (text: string): string[] =>
  [...new Set([...text.matchAll(BARE_IMPORT)].map((match) => packageOf(match[1]!)))].filter(
    (name) => !name.startsWith('node:'),
  );

/**
 * What Monaco's TypeScript sees: every code file of the project that isn't open (open files
 * are models), and the declarations of the packages they import, fetched once per app.
 */
export class TypeLibraries implements Disposable {
  private readonly _files = new Map<string, Disposable>();
  private readonly _libraries = new Map<string, string>();
  private readonly _resolved = new Set<string>();
  private readonly _models = new Set<string>();
  private readonly _subscription: Disposable;

  constructor(
    private readonly _monaco: Monaco,
    private readonly _project: ClientProject,
    private readonly _code: CodeService | undefined,
  ) {
    this._subscription = _project.fs.onDidChange((changes) => {
      for (const change of changes) {
        if (!this._isCode(change.path)) continue;
        if (change.type === 'deleted') this._remove(change.path);
        else void this._load(change.path);
      }
    });
    for (const entry of _project.fs.entries) {
      if (entry.kind === 'file' && this._isCode(entry.path)) void this._load(entry.path);
    }
  }

  /** Text of a type declaration file (read-only tabs from "go to definition"). */
  library(path: string): string | undefined {
    return this._libraries.get(path);
  }

  /** An open model now represents the file: its library copy would conflict. */
  modelOpened(path: string): void {
    this._models.add(path);
    this._files.get(path)?.dispose();
    this._files.delete(path);
  }

  modelClosed(path: string): void {
    this._models.delete(path);
    if (this._isCode(path)) void this._load(path);
  }

  /** Loads the declarations of the packages a text imports (unsaved edits included). */
  async resolveImports(path: string, text: string): Promise<void> {
    if (!this._code) return;
    const app = this._appRoot(path);
    for (const module of bareImports(text)) {
      const key = `${app}:${module}`;
      if (this._resolved.has(key)) continue;
      this._resolved.add(key);
      const files = await this._code.typeFiles(module, path).catch(() => []);
      for (const file of files) {
        if (this._libraries.has(file.path)) continue;
        this._libraries.set(file.path, file.text);
        this._add(file.path, file.text);
      }
    }
  }

  dispose(): void {
    this._subscription.dispose();
    for (const file of this._files.values()) file.dispose();
    this._files.clear();
  }

  private _isCode(path: string): boolean {
    return CODE.test(path) && !IGNORED.test(path);
  }

  /** Root of the app a file belongs to (packages resolve from there). */
  private _appRoot(path: string): string {
    const roots = this._project.model
      .get()
      .apps.map((app) => app.root)
      .filter((root) => root === '' || path.startsWith(`${root}/`))
      .sort((a, b) => b.length - a.length);
    return roots[0] ?? '';
  }

  private async _load(path: string): Promise<void> {
    if (this._models.has(path)) return;
    const { text } = await this._project.fs.readText(path).catch(() => ({ text: undefined }));
    if (text === undefined || this._models.has(path)) return;
    this._add(path, text);
    await this.resolveImports(path, text);
  }

  private _add(path: string, text: string): void {
    this._files.get(path)?.dispose();
    const ts = this._monaco.typescript;
    const uri = `file:///${path}`;
    const disposables = [
      ts.typescriptDefaults.addExtraLib(text, uri),
      ts.javascriptDefaults.addExtraLib(text, uri),
    ];
    this._files.set(path, { dispose: () => disposables.forEach((item) => item.dispose()) });
  }

  private _remove(path: string): void {
    this._files.get(path)?.dispose();
    this._files.delete(path);
  }
}
