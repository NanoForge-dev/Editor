import {
  type Disposable,
  DisposableStore,
  Emitter,
  type Event,
  type Observable,
  ObservableValue,
} from '@nanoforge-dev/editor-sdk';
import type { ThemeDefinition } from '@nanoforge-dev/editor-sdk/ui';

import { EditorDocument } from '../document/editor-document';
import { createUnsavedStore } from '../document/unsaved-store';
import { pathOf } from '../monaco/monaco';
import { monacoThemeOf } from '../monaco/monaco-theme';
import { TypeLibraries } from '../typing/type-libraries';
import { SETTING } from './code-editor-settings.const';
import type {
  CodeEditorServiceOptions,
  Comparison,
  EditorGroup,
  EditorLayout,
  OpenOptions,
  Reveal,
} from './code-editor.type';
import { minimalEdit, toMarker } from './editor-edits';
import { pairRenames } from './pair-renames';

export const SCRIPT_LIKE = /\.[cm]?[jt]sx?$/;
export const EMPTY: EditorLayout = { groups: [{ tabs: [], active: undefined }], focused: 0 };

/**
 * State of the Script screen for the open project: open documents, editor groups and tabs,
 * saving (explicit, autosave, actions on save), disk conflicts and diagnostics markers.
 */
export class CodeEditorService implements Disposable {
  readonly types: TypeLibraries;
  private readonly _layout = new ObservableValue<EditorLayout>(EMPTY);
  private readonly _comparisons = new ObservableValue<ReadonlyMap<string, Comparison>>(new Map());
  private readonly _documents = new Map<string, EditorDocument>();
  private readonly _loading = new Map<string, Promise<EditorDocument>>();
  private readonly _onReveal = new Emitter<Reveal>();
  private readonly _onDidChangeDocuments = new Emitter<void>();
  private readonly _pendingReveals = new Map<number, Reveal>();
  private readonly _store = new DisposableStore();
  private readonly _perDocument = new Map<string, DisposableStore>();
  private readonly _autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly _unsaved;

  readonly onReveal: Event<Reveal> = this._onReveal.event;
  /** A document was loaded or released. */
  readonly onDidChangeDocuments: Event<void> = this._onDidChangeDocuments.event;

  constructor(private readonly _options: CodeEditorServiceOptions) {
    const { monaco, project } = _options;
    this._unsaved = createUnsavedStore(project.id);
    this.types = this._store.add(new TypeLibraries(monaco, project, _options.code));
    this._store.add(
      project.fs.onDidChange((changes) => {
        const renames = pairRenames(changes);
        const written = new Set(
          changes.filter((change) => change.type !== 'deleted').map((change) => change.path),
        );
        for (const change of changes) {
          const document = this._documents.get(change.path);
          if (!document) continue;
          if (change.type !== 'deleted' || written.has(change.path)) {
            if (change.type !== 'deleted') void document.onDiskChange(false);
          } else if (renames.has(change.path))
            void this._retarget(change.path, renames.get(change.path)!).catch((error: unknown) =>
              this._options.logger.warn(`Could not follow ${change.path}`, error),
            );
          else if (!document.dirty.get() && !document.readOnly) this._closeEverywhere(change.path);
          else void document.onDiskChange(true);
        }
      }),
    );
    if (_options.diagnostics) {
      this._store.add({
        dispose: _options.diagnostics.all.subscribe(() => this._updateMarkers()),
      });
    }
    this._store.add(
      monaco.editor.registerEditorOpener({
        openCodeEditor: (_source, resource, selection) => {
          const position =
            selection && 'lineNumber' in selection
              ? { line: selection.lineNumber, column: selection.column }
              : selection
                ? { line: selection.startLineNumber, column: selection.startColumn }
                : {};
          void this.open(pathOf(resource), position);
          return true;
        },
      }),
    );
  }

  get layout(): Observable<EditorLayout> {
    return this._layout.readonly();
  }

  document(path: string): EditorDocument | undefined {
    return this._documents.get(path);
  }

  setting<T>(key: string): T {
    return this._options.settings.get<T>(key);
  }

  observeSetting<T>(key: string): Observable<T> {
    return this._options.settings.observe<T>(key);
  }

  /** Restores tabs (from the widget state) without opening files that are gone. */
  async restore(layout: EditorLayout | undefined): Promise<void> {
    if (!layout?.groups.length) return;
    const exists = (path: string) =>
      !!this._options.project.fs.entry(path) || !!this.types.library(path);
    const groups = layout.groups.slice(0, 2).map((group) => {
      const tabs = group.tabs.filter(exists);
      const active = group.active && tabs.includes(group.active) ? group.active : tabs[0];
      return { tabs, active };
    });
    this._layout.set({ groups, focused: Math.min(layout.focused, groups.length - 1) });
    await Promise.all(
      groups.flatMap((group) => group.tabs.map((path) => this._load(path).catch(() => undefined))),
    );
  }

  /** Opens a file in a tab of the focused (or given) group and shows the position. */
  async open(path: string, options: OpenOptions = {}): Promise<void> {
    await this._load(path);
    const layout = this._layout.get();
    const index = Math.min(options.group ?? layout.focused, layout.groups.length - 1);
    const groups = layout.groups.map((group, i) =>
      i === index
        ? { tabs: group.tabs.includes(path) ? group.tabs : [...group.tabs, path], active: path }
        : group,
    );
    this._layout.set({ groups, focused: index });
    if (options.line) {
      const reveal = { group: index, path, line: options.line, column: options.column ?? 1 };
      this._pendingReveals.set(index, reveal);
      this._onReveal.fire(reveal);
    }
  }

  /** A position to show once the group displays the file (consumed). */
  takeReveal(group: number, path: string): Reveal | undefined {
    const reveal = this._pendingReveals.get(group);
    if (reveal?.path !== path) return undefined;
    this._pendingReveals.delete(group);
    return reveal;
  }

  activate(group: number, path: string): void {
    this._update(group, (current) => ({ ...current, active: path }));
    this.focusGroup(group);
  }

  focusGroup(group: number): void {
    const layout = this._layout.get();
    if (layout.focused !== group && group < layout.groups.length) {
      this._layout.set({ ...layout, focused: group });
    }
  }

  /** Closes a tab. The document is released when no group shows it anymore. */
  close(group: number, path: string): void {
    this.closeComparison(path);
    this._update(group, (current) => {
      const index = current.tabs.indexOf(path);
      const tabs = current.tabs.filter((tab) => tab !== path);
      const active =
        current.active === path
          ? (tabs[Math.min(index, tabs.length - 1)] ?? undefined)
          : current.active;
      return { tabs, active };
    });
    let layout = this._layout.get();
    if (layout.groups.length > 1 && !layout.groups[group]?.tabs.length) {
      const groups = layout.groups.filter((_, i) => i !== group);
      layout = { groups, focused: Math.min(layout.focused, groups.length - 1) };
      this._layout.set(layout);
    }
    if (!layout.groups.some((candidate) => candidate.tabs.includes(path))) this._release(path);
  }

  /** Shows the active file of the focused group in a second group on the right. */
  splitRight(): void {
    const layout = this._layout.get();
    const active = layout.groups[layout.focused]?.active;
    if (layout.groups.length > 1) {
      if (active) void this.open(active, { group: 1 });
      return;
    }
    this._layout.set({
      groups: [...layout.groups, { tabs: active ? [active] : [], active }],
      focused: 1,
    });
  }

  /** Files shown side by side with another text (a previous version), by path. */
  get comparisons(): Observable<ReadonlyMap<string, Comparison>> {
    return this._comparisons.readonly();
  }

  /** Opens a file and shows it next to another text, e.g. its last committed version. */
  async compare(path: string, comparison: Comparison): Promise<void> {
    await this.open(path);
    this._comparisons.set(new Map(this._comparisons.get()).set(path, comparison));
  }

  closeComparison(path: string): void {
    if (!this._comparisons.get().has(path)) return;
    const next = new Map(this._comparisons.get());
    next.delete(path);
    this._comparisons.set(next);
  }

  activePath(): string | undefined {
    const layout = this._layout.get();
    return layout.groups[layout.focused]?.active;
  }

  async save(path = this.activePath()): Promise<void> {
    const document = path ? this._documents.get(path) : undefined;
    if (!document || document.readOnly) return;
    await this._guard(`save ${path}`, () => document.save());
  }

  async saveAll(): Promise<void> {
    const failed = await this._options.documents.saveAll();
    for (const { uri, error } of failed) this._report(`Could not save ${uri}`, error);
  }

  async revert(path = this.activePath()): Promise<void> {
    const document = path ? this._documents.get(path) : undefined;
    await this._guard(`revert ${path}`, async () => document?.revert());
  }

  /** Reformats a file with Prettier (the project's, see `code.format`). */
  async format(path = this.activePath()): Promise<void> {
    const document = path ? this._documents.get(path) : undefined;
    if (!document || document.readOnly || !this._options.code || !path) return;
    const before = document.getText();
    const result = await this._options.code.format(path, before);
    if (result.formatter === 'none' || document.getText() !== before) return;
    const edit = minimalEdit(before, result.text);
    if (edit.start !== edit.end || edit.text) {
      await this._options.documents.edit(path, [edit], { label: 'Format with Prettier' });
    }
  }

  async organizeImports(path = this.activePath()): Promise<void> {
    const document = path ? this._documents.get(path) : undefined;
    if (!document || document.readOnly || !this._options.code || !path || !SCRIPT_LIKE.test(path))
      return;
    const before = document.getText();
    const edits = await this._options.code.organizeImports(path);
    if (edits.length && document.getText() === before) {
      await this._options.documents.edit(path, edits, { label: 'Organize imports' });
    }
  }

  /** Focus left the editor, a tab or the window: autosave when asked to. */
  focusLost(): void {
    if (this.setting<boolean>(SETTING.autoSaveOnFocusLoss)) void this._autoSaveAll();
  }

  applyTheme(theme: ThemeDefinition): void {
    this._options.monaco.editor.defineTheme('nanoforge', monacoThemeOf(theme));
    this._options.monaco.editor.setTheme('nanoforge');
  }

  dispose(): void {
    for (const timer of this._autoSaveTimers.values()) clearTimeout(timer);
    for (const path of [...this._documents.keys()]) this._release(path);
    this._store.dispose();
    this._onReveal.dispose();
    this._onDidChangeDocuments.dispose();
  }

  private _update(group: number, update: (group: EditorGroup) => EditorGroup): void {
    const layout = this._layout.get();
    this._layout.set({
      ...layout,
      groups: layout.groups.map((current, i) => (i === group ? update(current) : current)),
    });
  }

  /** Closes the tabs of a file in every group. */
  private _closeEverywhere(path: string): void {
    for (;;) {
      const group = this._layout
        .get()
        .groups.findIndex((candidate) => candidate.tabs.includes(path));
      if (group < 0) return;
      this.close(group, path);
    }
  }

  /** A file was renamed or moved: its tabs show the new path, unsaved text included. */
  private async _retarget(from: string, to: string): Promise<void> {
    const old = this._documents.get(from);
    const unsaved = old?.dirty.get() ? old.getText() : undefined;
    const next = await this._load(to);
    if (unsaved !== undefined && next.getText() !== unsaved)
      next.applyEdits([{ start: 0, end: next.getText().length, text: unsaved }], undefined);
    const layout = this._layout.get();
    this._layout.set({
      ...layout,
      groups: layout.groups.map((group) => ({
        tabs: [...new Set(group.tabs.map((tab) => (tab === from ? to : tab)))],
        active: group.active === from ? to : group.active,
      })),
    });
    this.closeComparison(from);
    this._release(from);
  }

  private _load(path: string): Promise<EditorDocument> {
    const open = this._documents.get(path);
    if (open) return Promise.resolve(open);
    let loading = this._loading.get(path);
    if (!loading) {
      loading = this._createDocument(path).finally(() => this._loading.delete(path));
      this._loading.set(path, loading);
    }
    return loading;
  }

  private async _createDocument(path: string): Promise<EditorDocument> {
    const { monaco, documents, code } = this._options;
    const host = {
      monaco,
      backend: documents.backend,
      unsaved: this._unsaved,
      beforeSave: (document: EditorDocument) => this._beforeSave(document),
    };
    const packaged = path === 'nf_modules' || path.startsWith('nf_modules/');
    const library = packaged
      ? (await documents.backend.read(path)).text
      : this._options.project.fs.entry(path)
        ? undefined
        : this.types.library(path);
    const document =
      library === undefined
        ? await EditorDocument.open(host, path)
        : EditorDocument.library(host, path, library);
    const store = new DisposableStore();
    if (!document.readOnly) {
      documents.historyContext(path);
      this.types.modelOpened(path);
      store.add(documents.register(document));
      if (code && SCRIPT_LIKE.test(path)) store.add(code.watchDiagnostics(path));
      store.add(
        document.onDidChange(({ origin }) => {
          void this.types.resolveImports(path, document.getText());
          if (!origin) this._scheduleAutoSave(path);
        }),
      );
      void this.types.resolveImports(path, document.getText());
    }
    this._documents.set(path, document);
    this._perDocument.set(path, store);
    this._updateMarkers();
    this._onDidChangeDocuments.fire();
    return document;
  }

  private _release(path: string): void {
    const document = this._documents.get(path);
    if (!document) return;
    clearTimeout(this._autoSaveTimers.get(path));
    this._autoSaveTimers.delete(path);
    this._perDocument.get(path)?.dispose();
    this._perDocument.delete(path);
    this._documents.delete(path);
    document.dispose();
    if (!document.readOnly) this.types.modelClosed(path);
    this._onDidChangeDocuments.fire();
  }

  private async _beforeSave(document: EditorDocument): Promise<void> {
    if (this.setting<boolean>(SETTING.organizeImportsOnSave)) {
      await this.organizeImports(document.uri).catch((error: unknown) =>
        this._options.logger.warn(`Could not organize the imports of ${document.uri}`, error),
      );
    }
    if (this.setting<boolean>(SETTING.formatOnSave)) {
      await this.format(document.uri).catch((error: unknown) =>
        this._report(`Could not format ${document.uri}`, error),
      );
    }
  }

  private _scheduleAutoSave(path: string): void {
    if (!this.setting<boolean>(SETTING.autoSaveAfterDelay)) return;
    clearTimeout(this._autoSaveTimers.get(path));
    this._autoSaveTimers.set(
      path,
      setTimeout(() => {
        this._autoSaveTimers.delete(path);
        const document = this._documents.get(path);
        if (document?.dirty.get() && !document.conflict.get()) void this.save(path);
      }, this.setting<number>(SETTING.autoSaveDelayMs)),
    );
  }

  private async _autoSaveAll(): Promise<void> {
    for (const document of this._documents.values()) {
      if (document.dirty.get() && !document.conflict.get()) await this.save(document.uri);
    }
  }

  private _updateMarkers(): void {
    const { monaco, diagnostics } = this._options;
    if (!diagnostics) return;
    for (const document of this._documents.values()) {
      if (document.readOnly) continue;
      monaco.editor.setModelMarkers(
        document.model,
        'nanoforge',
        diagnostics
          .forUri(document.uri)
          .map((diagnostic) => toMarker(monaco, document.model, diagnostic)),
      );
    }
  }

  private async _guard(action: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this._report(`Could not ${action}`, error);
    }
  }

  private _report(title: string, error: unknown): void {
    this._options.logger.warn(title, error);
    this._options.notifications?.notify('error', title, {
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
