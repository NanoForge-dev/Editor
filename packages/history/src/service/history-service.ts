import {
  type Disposable,
  DisposableStore,
  Emitter,
  type Event,
  type Observable,
  ObservableValue,
  constant,
  createToken,
  observe,
} from '@nanoforge-dev/editor-kernel';

import type { CommandOrigin, HistoryCommand } from '../command/history-command.type';
import { HistoryStack } from '../stack/history-stack';
import type {
  ContextInvalidation,
  Deserializer,
  HistoryContext,
  HistoryContextInfo,
  HistoryContextOptions,
  HistoryServiceOptions,
  HistoryStore,
  PersistedEntry,
} from './history-service.type';

/** One undo/redo stack per context (document, layout, settings…). */
export class HistoryService implements Disposable {
  private readonly _contexts = new Map<string, HistoryContext>();
  private readonly _onDidChange = new Emitter<string>();
  private readonly _onDidInvalidate = new Emitter<ContextInvalidation>();
  private readonly _list = new ObservableValue<readonly HistoryContextInfo[]>([]);
  private readonly _store = new DisposableStore();
  private readonly _limit: Observable<number>;
  private readonly _mergeWindow: Observable<number>;
  private _localOrigin: CommandOrigin;
  private readonly _deserializers = new Map<string, Deserializer>();
  private readonly _persisted: { match: (id: string) => boolean; store: HistoryStore }[] = [];

  /** Fires with the id of the context whose stack changed. */
  readonly onDidChange: Event<string> = this._onDidChange.event;
  readonly onDidInvalidate: Event<ContextInvalidation> = this._onDidInvalidate.event;

  constructor(private readonly _options: HistoryServiceOptions = {}) {
    this._limit = _options.limit ?? constant(100);
    this._mergeWindow = _options.mergeWindowMs ?? constant(500);
    this._localOrigin = _options.localOrigin ?? { kind: 'user', id: 'local' };
    this._store.add(
      observe(
        this._limit,
        () => {
          for (const context of this._contexts.values()) void context.stack.trim();
        },
        { immediate: false },
      ),
    );
  }

  get localOrigin(): CommandOrigin {
    return this._localOrigin;
  }

  set localOrigin(origin: CommandOrigin) {
    this._localOrigin = origin;
  }

  /** Every context with its stack state, for the history panel. */
  get contexts(): Observable<readonly HistoryContextInfo[]> {
    return this._list.readonly();
  }

  registerContext(options: HistoryContextOptions): HistoryContext {
    if (this._contexts.has(options.id))
      throw new Error(`History context "${options.id}" already exists`);
    const stack = new HistoryStack({
      localOrigin: () => this._localOrigin,
      limit: () => this._limit.get(),
      mergeWindowMs: () => this._mergeWindow.get(),
      budgetBytes: () => this._options.budgetBytes ?? 64 * 1024 * 1024,
      ...(this._options.now && { now: this._options.now }),
    });
    const subscriptions = new DisposableStore();
    subscriptions.add(stack.onDidChange(() => this._changed(options.id)));
    subscriptions.add(
      stack.onDidInvalidate((reason) =>
        this._onDidInvalidate.fire({ contextId: options.id, reason }),
      ),
    );
    const context: HistoryContext = {
      id: options.id,
      label: options.label,
      owner: options.owner ?? 'core',
      stack,
      dispose: () => {
        if (this._contexts.get(options.id) !== context) return;
        this._contexts.delete(options.id);
        subscriptions.dispose();
        stack.dispose();
        this._changed(options.id);
      },
    };
    this._contexts.set(options.id, context);
    this._changed(options.id);
    const persisted = this._persisted.find((candidate) => candidate.match(options.id));
    if (persisted) subscriptions.add(this._persistContext(context, persisted.store));
    return context;
  }

  /** Rebuilds commands of a type from their serialized data (history kept across reloads). */
  registerDeserializer(type: string, deserialize: Deserializer): Disposable {
    this._deserializers.set(type, deserialize);
    return { dispose: () => this._deserializers.delete(type) };
  }

  /**
   * Keeps the history of the matching contexts in a store: restored when such a context is
   * registered, saved when it changes. Only histories whose steps are all serializable are
   * saved.
   */
  persist(match: (id: string) => boolean, store: HistoryStore): Disposable {
    const entry = { match, store };
    this._persisted.push(entry);
    return {
      dispose: () => {
        const index = this._persisted.indexOf(entry);
        if (index >= 0) this._persisted.splice(index, 1);
      },
    };
  }

  /** Undoes or redoes a context until the entry is its last applied step. */
  async goTo(contextId: string, entryId: number): Promise<void> {
    await this._contexts.get(contextId)?.stack.goTo(entryId);
  }

  async clear(contextId: string): Promise<void> {
    await this._contexts.get(contextId)?.stack.clear();
  }

  get(id: string): HistoryContext | undefined {
    return this._contexts.get(id);
  }

  /** Undoes in the given context; returns false when there was nothing to undo. */
  async undo(contextId: string | undefined): Promise<boolean> {
    const context = contextId ? this._contexts.get(contextId) : undefined;
    return context ? context.stack.undo() : false;
  }

  async redo(contextId: string | undefined): Promise<boolean> {
    const context = contextId ? this._contexts.get(contextId) : undefined;
    return context ? context.stack.redo() : false;
  }

  dispose(): void {
    for (const context of [...this._contexts.values()]) context.dispose();
    this._store.dispose();
    this._onDidChange.dispose();
    this._onDidInvalidate.dispose();
  }

  private _persistContext(context: HistoryContext, store: HistoryStore): Disposable {
    let restored = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const entries: PersistedEntry[] = [];
        for (const entry of context.stack.state.past) {
          const command = entry.command.serialize?.();
          if (!command) return; // not all serializable: keep the stored history as is
          entries.push({ command, origin: entry.origin, time: entry.time });
        }
        void store.save(context.id, entries).catch(() => undefined);
      }, 300);
    };
    void store
      .load(context.id)
      .then(async (entries) => {
        const commands = (entries ?? []).map((entry) => ({
          ...entry,
          command: this._deserializers.get(entry.command.type)?.(
            entry.command.data,
            entry.command.label,
          ),
        }));
        if (
          commands.length &&
          commands.every((entry) => entry.command) &&
          !context.stack.state.past.length
        ) {
          await context.stack.restore(
            commands as { command: HistoryCommand; origin: CommandOrigin; time: number }[],
          );
        }
      })
      .catch(() => undefined)
      .finally(() => (restored = true));
    const subscription = context.stack.onDidChange(() => {
      if (restored) save();
    });
    return {
      dispose: () => {
        clearTimeout(timer);
        subscription.dispose();
      },
    };
  }

  private _changed(id: string): void {
    this._list.set(
      [...this._contexts.values()].map((context) => ({
        id: context.id,
        label: context.label,
        owner: context.owner,
        state: context.stack.state,
      })),
    );
    this._onDidChange.fire(id);
  }
}

export const HistoryServiceToken = createToken<HistoryService>('history.service');
