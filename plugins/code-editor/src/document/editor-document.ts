import {
  type CommandOrigin,
  type DocumentChange,
  Emitter,
  type Event,
  type Observable,
  ObservableValue,
  type OpenDocument,
  type TextEdit,
} from '@nanoforge-dev/editor-sdk';

import { type Monaco, type monaco, uriOf } from '../monaco/monaco';
import type { Conflict, DocumentHost } from './editor-document.type';

const PERSIST_DELAY_MS = 400;

/** The model of a file (Monaco may have created it already, e.g. to peek a definition). */
const modelFor = (monaco: Monaco, path: string, text: string): monaco.editor.ITextModel => {
  const existing = monaco.editor.getModel(uriOf(path));
  if (!existing) return monaco.editor.createModel(text, undefined, uriOf(path));
  if (existing.getValue() !== text) existing.setValue(text);
  return existing;
};

const isConflict = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'CONFLICT';

/**
 * A file open in the code editor: a Monaco model, registered with the DocumentService so edits
 * of other plugins (codegen) go to it. Unsaved edits are kept locally until saved or reverted.
 */
export class EditorDocument implements OpenDocument {
  readonly kind = 'text' as const;
  private readonly _dirty = new ObservableValue(false);
  private readonly _conflict = new ObservableValue<Conflict | undefined>(undefined);
  private readonly _onDidChange = new Emitter<DocumentChange>();
  private readonly _listener: monaco.IDisposable;
  private _savedVersion: number;
  private _hash: string | null;
  private _origin: CommandOrigin | undefined;
  private _persistTimer: ReturnType<typeof setTimeout> | undefined;
  private _restoring = false;

  readonly onDidChange: Event<DocumentChange> = this._onDidChange.event;

  /** Opens a project file, restoring unsaved edits kept from a previous session. */
  static async open(host: DocumentHost, path: string): Promise<EditorDocument> {
    const disk = await host.backend.read(path);
    const model = modelFor(host.monaco, path, disk.text);
    const document = new EditorDocument(host, path, model, disk.hash, false);
    const unsaved = await host.unsaved.get(path).catch(() => undefined);
    if (unsaved && unsaved.text !== disk.text) {
      document._restoring = true;
      document._replaceAll(unsaved.text);
      document._restoring = false;
      if (unsaved.baseHash !== disk.hash) {
        document._conflict.set({ diskText: disk.text, diskHash: disk.hash });
      }
    }
    return document;
  }

  /** Opens a type declaration file (not part of the project, never saved). */
  static library(host: DocumentHost, path: string, text: string): EditorDocument {
    return new EditorDocument(host, path, modelFor(host.monaco, path, text), null, true);
  }

  private constructor(
    private readonly _host: DocumentHost,
    readonly uri: string,
    readonly model: monaco.editor.ITextModel,
    hash: string | null,
    /** Library declarations (go to definition): never saved. */
    readonly readOnly: boolean,
  ) {
    this._hash = hash;
    this._savedVersion = model.getAlternativeVersionId();
    this._listener = model.onDidChangeContent((event) => {
      this._dirty.set(!this.readOnly && model.getAlternativeVersionId() !== this._savedVersion);
      this._onDidChange.fire({
        uri,
        edits: event.changes.map((change) => ({
          start: change.rangeOffset,
          end: change.rangeOffset + change.rangeLength,
          text: change.text,
        })),
        origin: this._origin,
      });
      if (!this._restoring) this._schedulePersist();
    });
  }

  get dirty(): Observable<boolean> {
    return this._dirty.readonly();
  }

  get conflict(): Observable<Conflict | undefined> {
    return this._conflict.readonly();
  }

  getText(): string {
    return this.model.getValue();
  }

  applyEdits(edits: readonly TextEdit[], origin: CommandOrigin | undefined): TextEdit[] {
    const model = this.model;
    const operations = edits.map((edit) => ({
      range: this._host.monaco.Range.fromPositions(
        model.getPositionAt(edit.start),
        model.getPositionAt(edit.end),
      ),
      text: edit.text,
    }));
    let inverse: monaco.editor.IValidEditOperation[] = [];
    this._origin = origin;
    try {
      model.pushStackElement();
      model.pushEditOperations(null, operations, (operations) => {
        inverse = operations;
        return null;
      });
      model.pushStackElement();
    } finally {
      this._origin = undefined;
    }
    return inverse.map((operation) => ({
      start: model.getOffsetAt(operation.range.getStartPosition()),
      end: model.getOffsetAt(operation.range.getEndPosition()),
      text: operation.text ?? '',
    }));
  }

  async save(): Promise<void> {
    if (this.readOnly) return;
    if (this._conflict.get()) throw new Error(`${this.uri} changed on disk: resolve it first`);
    await this._host.beforeSave(this);
    const text = this.getText();
    const version = this.model.getAlternativeVersionId();
    try {
      const { hash } = await this._host.backend.write(this.uri, text, this._hash);
      this._markSaved(hash, version);
    } catch (error) {
      if (isConflict(error)) await this._detectConflict();
      throw error;
    }
  }

  async revert(): Promise<void> {
    if (this.readOnly) return;
    const disk = await this._host.backend.read(this.uri);
    this._replaceAll(disk.text);
    this._conflict.set(undefined);
    this._markSaved(disk.hash, this.model.getAlternativeVersionId());
  }

  /** The file changed on disk: reload it, or report a conflict when there are unsaved edits. */
  async onDiskChange(deleted: boolean): Promise<void> {
    if (this.readOnly) return;
    if (deleted) {
      this._conflict.set({ diskText: null, diskHash: null });
      return;
    }
    const disk = await this._host.backend.read(this.uri).catch(() => undefined);
    if (!disk || disk.hash === this._hash) return;
    if (!this._dirty.get()) {
      this._replaceAll(disk.text);
      this._markSaved(disk.hash, this.model.getAlternativeVersionId());
    } else this._conflict.set({ diskText: disk.text, diskHash: disk.hash });
  }

  /** Conflict resolution: keep the unsaved edits (the next save overwrites the disk). */
  keepMine(): void {
    const conflict = this._conflict.get();
    if (!conflict) return;
    this._hash = conflict.diskHash;
    this._conflict.set(undefined);
  }

  /** Conflict resolution: take the disk version (undo brings the edits back). */
  loadDisk(): void {
    const conflict = this._conflict.get();
    if (!conflict || conflict.diskText === null) return;
    this._replaceAll(conflict.diskText);
    this._conflict.set(undefined);
    this._markSaved(conflict.diskHash, this.model.getAlternativeVersionId());
  }

  /** Replaces the whole text as one undoable edit. */
  replaceAll(text: string, origin?: CommandOrigin): void {
    if (text === this.getText()) return;
    this._origin = origin;
    try {
      this._replaceAll(text);
    } finally {
      this._origin = undefined;
    }
  }

  dispose(): void {
    clearTimeout(this._persistTimer);
    this._listener.dispose();
    this._onDidChange.dispose();
    this.model.dispose();
  }

  private _replaceAll(text: string): void {
    this.model.pushStackElement();
    this.model.pushEditOperations(
      null,
      [{ range: this.model.getFullModelRange(), text }],
      () => null,
    );
    this.model.pushStackElement();
  }

  private _markSaved(hash: string | null, version: number): void {
    this._hash = hash;
    this._savedVersion = version;
    this._dirty.set(this.model.getAlternativeVersionId() !== version);
    if (!this._dirty.get()) {
      clearTimeout(this._persistTimer);
      void this._host.unsaved.delete(this.uri).catch(() => undefined);
    }
  }

  private async _detectConflict(): Promise<void> {
    const disk = await this._host.backend.read(this.uri).catch(() => undefined);
    this._conflict.set({ diskText: disk?.text ?? null, diskHash: disk?.hash ?? null });
  }

  private _schedulePersist(): void {
    if (this.readOnly) return;
    clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => {
      const operation = this._dirty.get()
        ? this._host.unsaved.set(this.uri, {
            text: this.getText(),
            baseHash: this._hash,
            time: Date.now(),
          })
        : this._host.unsaved.delete(this.uri);
      void operation.catch(() => undefined);
    }, PERSIST_DELAY_MS);
  }
}
