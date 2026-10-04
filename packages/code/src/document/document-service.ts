import {
  type CommandOrigin,
  type CommandPreview,
  type HistoryCommand,
  type HistoryContext,
  type HistoryService,
  type TextEdit,
  applyTextEdits,
} from '@nanoforge-dev/editor-history';
import {
  type Disposable,
  DisposableStore,
  Emitter,
  type Event,
  createToken,
  toDisposable,
} from '@nanoforge-dev/editor-kernel';
import type { ProjectFs } from '@nanoforge-dev/editor-project';

import { DOCUMENT_EDITS } from './document-contributions';
import { previewOf } from './document-preview';
import type { DocumentBackend, DocumentChange, OpenDocument } from './document.type';

export const projectFsBackend = (fs: ProjectFs): DocumentBackend => ({
  onDidChange: (listener, disposables) =>
    fs.onDidChange((changes) => listener(changes.map((change) => change.path)), disposables),
  read: (uri) => fs.readText(uri),
  write: (uri, text, expectedHash) => fs.write(uri, text, { expectedHash }),
});

/** FNV-1a fingerprint of a text (undo validity checks, not security). */
export const fingerprint = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16)}:${text.length}`;
};

/**
 * The single path for editing documents: edits go to the open document when there is one
 * (the editor stays in sync, no dirty-buffer conflicts), otherwise to the backend (files).
 */
export class DocumentService implements Disposable {
  private readonly _open = new Map<string, OpenDocument>();
  private readonly _written = new Map<string, string>();
  private readonly _onDidChange = new Emitter<DocumentChange>();
  private readonly _onDidChangeExternally = new Emitter<string>();
  private readonly _onDidOpen = new Emitter<string>();
  private readonly _store = new DisposableStore();

  /** Every applied change, from open documents and file edits. */
  readonly onDidChange: Event<DocumentChange> = this._onDidChange.event;
  /** A file the editor edited was changed by something else (hand edit, git…). */
  readonly onDidChangeExternally: Event<string> = this._onDidChangeExternally.event;
  readonly onDidOpen: Event<string> = this._onDidOpen.event;

  private readonly _historyContexts = new Map<string, HistoryContext>();

  constructor(
    private readonly _backend: DocumentBackend,
    /** Gives each document an undo context (`file:<uri>`) for `edit`. */
    private readonly _history?: HistoryService,
  ) {
    this._store.add(_backend.onDidChange((uris) => void this._checkExternal(uris)));
  }

  register(document: OpenDocument): Disposable {
    if (this._open.has(document.uri)) throw new Error(`${document.uri} is already open`);
    this._open.set(document.uri, document);
    const forward = document.onDidChange((change) => this._onDidChange.fire(change));
    this._onDidOpen.fire(document.uri);
    return toDisposable(() => {
      forward.dispose();
      if (this._open.get(document.uri) === document) this._open.delete(document.uri);
    });
  }

  get(uri: string): OpenDocument | undefined {
    return this._open.get(uri);
  }

  get openUris(): string[] {
    return [...this._open.keys()];
  }

  /** Where documents live when they are not open (editors read and write through it). */
  get backend(): DocumentBackend {
    return this._backend;
  }

  /** Open documents with unsaved changes. */
  get dirtyUris(): string[] {
    return [...this._open.values()].filter((doc) => doc.dirty.get()).map((doc) => doc.uri);
  }

  /** Saves an open document if it has unsaved changes (a closed one is always saved). */
  async save(uri: string): Promise<void> {
    const open = this._open.get(uri);
    if (open?.dirty.get()) await open.save();
  }

  /** Saves every open document with unsaved changes; resolves with the ones that failed. */
  async saveAll(): Promise<{ uri: string; error: unknown }[]> {
    const failed: { uri: string; error: unknown }[] = [];
    for (const uri of this.dirtyUris) {
      await this._open
        .get(uri)
        ?.save()
        .catch((error: unknown) => failed.push({ uri, error }));
    }
    return failed;
  }

  async getText(uri: string): Promise<string> {
    return this._open.get(uri)?.getText() ?? (await this._backend.read(uri)).text;
  }

  /** Applies edits once (not undoable); returns their inverse. */
  async applyEdits(
    uri: string,
    edits: readonly TextEdit[],
    origin?: CommandOrigin,
  ): Promise<TextEdit[]> {
    if (!edits.length) return [];
    const open = this._open.get(uri);
    if (open) return open.applyEdits(edits, origin);
    const current = await this._backend.read(uri);
    const { text, inverse } = applyTextEdits(current.text, edits);
    const { hash } = await this._backend.write(uri, text, current.hash);
    this._written.set(uri, hash);
    this._onDidChange.fire({ uri, edits, origin });
    return inverse;
  }

  /** The undo context of a document (`file:<uri>`), created on first use. */
  historyContext(uri: string): HistoryContext | undefined {
    if (!this._history) return undefined;
    let context = this._historyContexts.get(uri);
    if (!context) {
      const id = documentHistoryId(uri);
      context =
        this._history.get(id) ??
        this._history.registerContext({ id, label: uri.split('/').at(-1) ?? uri });
      this._historyContexts.set(uri, context);
    }
    return context;
  }

  /** Applies edits as one undo step of the document's history context. */
  async edit(
    uri: string,
    edits: readonly TextEdit[],
    options: { label: string; origin?: CommandOrigin; mergeKey?: string },
  ): Promise<void> {
    const context = this.historyContext(uri);
    const command = this.editCommand(uri, edits, options);
    if (context) await context.stack.push(command);
    else await command.do();
  }

  /**
   * An undoable edit. Undo/redo check that the document still has the content the edit
   * produced; otherwise the step is dropped by the history. It carries a preview of the changed
   * lines and can be serialized (history kept across reloads, see `restoreEditCommand`).
   */
  editCommand(
    uri: string,
    edits: readonly TextEdit[],
    options: { label: string; origin?: CommandOrigin; mergeKey?: string },
  ): HistoryCommand {
    return this._editCommand(
      { uri, forward: [...edits], inverse: [], expected: '' },
      options,
      false,
    );
  }

  /** Rebuilds an edit command from `serialize()` data (already applied). */
  restoreEditCommand(data: unknown, label: string): HistoryCommand | undefined {
    const state = data as Partial<EditState> | undefined;
    if (!state?.uri || !Array.isArray(state.forward) || !Array.isArray(state.inverse))
      return undefined;
    return this._editCommand(
      {
        uri: state.uri,
        forward: state.forward,
        inverse: state.inverse,
        expected: state.expected ?? '',
        ...(state.preview && { preview: state.preview }),
      },
      { label },
      true,
    );
  }

  dispose(): void {
    for (const context of this._historyContexts.values()) context.dispose();
    this._historyContexts.clear();
    this._store.dispose();
    this._onDidChange.dispose();
    this._onDidChangeExternally.dispose();
    this._onDidOpen.dispose();
  }

  private _editCommand(
    state: EditState,
    options: { label: string; origin?: CommandOrigin; mergeKey?: string },
    applied: boolean,
  ): HistoryCommand {
    const run = async (operations: readonly TextEdit[]) => {
      const before = await this.getText(state.uri);
      const result = await this.applyEdits(state.uri, operations, options.origin);
      const after = await this.getText(state.uri);
      state.expected = fingerprint(after);
      return { result, before, after };
    };
    const command: HistoryCommand & { preview?: CommandPreview } = {
      label: options.label,
      ...(options.origin && { origin: options.origin }),
      ...(options.mergeKey && { mergeKey: options.mergeKey }),
      sizeBytes: state.forward.reduce((total, edit) => total + edit.text.length * 2 + 16, 0),
      ...(state.preview && { preview: state.preview }),
      do: async () => {
        if (applied) return;
        const { result, before, after } = await run(state.forward);
        state.inverse = result;
        state.preview = previewOf(state.uri, before, after);
        (command as { preview?: CommandPreview }).preview = state.preview;
      },
      undo: async () => {
        applied = false;
        state.forward = (await run(state.inverse)).result;
      },
      redo: async () => {
        state.inverse = (await run(state.forward)).result;
      },
      isValid: async () => fingerprint(await this.getText(state.uri)) === state.expected,
      serialize: () => ({ type: DOCUMENT_EDITS, label: options.label, data: { ...state } }),
    };
    return command;
  }

  private async _checkExternal(uris: readonly string[]): Promise<void> {
    for (const uri of uris) {
      const written = this._written.get(uri);
      if (!written || this._open.has(uri)) continue;
      const current = await this._backend.read(uri).then(
        (file) => file.hash,
        () => null,
      );
      if (current === written) continue;
      this._written.delete(uri);
      this._onDidChangeExternally.fire(uri);
    }
  }
}

export const DocumentServiceToken = createToken<DocumentService>('code.documents');

/** Id of a document's undo context. */
export const documentHistoryId = (uri: string): string => `file:${uri}`;

interface EditState {
  uri: string;
  forward: TextEdit[];
  inverse: TextEdit[];
  /** Fingerprint of the document after the command (undo validity). */
  expected: string;
  preview?: CommandPreview;
}
