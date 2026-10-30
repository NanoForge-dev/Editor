import type { CommandOrigin, HistoryCommand } from '@nanoforge-dev/editor-history';
import {
  type Disposable,
  DisposableStore,
  Emitter,
  type Event,
  type Logger,
  createToken,
} from '@nanoforge-dev/editor-kernel';
import type { ProjectFs } from '@nanoforge-dev/editor-project';
import { CodeContract } from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';

import type { DiagnosticsService } from '../diagnostics/diagnostics-service';
import { type DocumentService, fingerprint } from '../document/document-service';
import { CODE_FILE } from '../engine/code-file.const';
import type { CodeDiagnostic, CodeSymbol, TextEdit } from '../engine/engine.type';
import type { MetaRequest, MetaResponse } from '../engine/extract-meta';
import type { EngineApi, EngineHostApi } from '../worker-rpc/serve-engine';
import { type MessageEndpoint, type Remote, expose, wrap } from '../worker-rpc/worker-rpc';

/** Installed packages are read-only: their problems are not the user's to fix. */
const NOT_CHECKED = /(^|\/)nf_modules\//;
const CHECK_BATCH = 16;

/** Folders never mirrored into the code worker. */
const EXCLUDED = /(^|\/)(node_modules|dist|coverage|\.nanoforge|\.git|\.turbo)(\/|$)/;

const TSCONFIG = 'tsconfig.json';

/** Marks a step in the performance timeline, and measures it from `since` (`<name>:time`). */
const mark = (name: string, since?: string): void => {
  if (typeof performance === 'undefined' || !performance.mark) return;
  performance.mark(name);
  if (since && performance.getEntriesByName(since).length)
    performance.measure(`${name}:time`, since, name);
};

export const isCodeFile = (path: string): boolean => CODE_FILE.test(path) && !EXCLUDED.test(path);

export interface WorkerEndpoint extends MessageEndpoint {
  terminate?(): void;
}

export interface CodeServiceOptions {
  readonly projectId: string;
  readonly fs: ProjectFs;
  readonly rpc: RpcClient;
  readonly documents: DocumentService;
  readonly diagnostics: DiagnosticsService;
  /** Starts the code worker (a Web Worker in browsers, a MessagePort in tests). */
  readonly createWorker: () => WorkerEndpoint;
  readonly logger?: Logger;
  /** Delay before re-checking watched files after a change. */
  readonly diagnosticsDelayMs?: number;
}

/** Files that change when dependencies are installed. */
const DEPENDENCIES =
  /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$/;

/**
 * TypeScript services of the open project, computed in a worker started on first use. The
 * worker mirrors the project's code files and the unsaved text of open documents.
 */
export class CodeService implements Disposable {
  private _engine: Promise<Remote<EngineApi>> | undefined;
  private _endpoint: WorkerEndpoint | undefined;
  private readonly _store = new DisposableStore();
  private readonly _watched = new Set<string>();
  private readonly _pendingDiagnostics = new Set<string>();
  private _diagnosticsTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly _plugins = new Map<string, string>();
  private _projectChecks = 0;
  private _projectCheckRun = 0;
  private _projectCheckTimer: ReturnType<typeof setTimeout> | undefined;
  private _disposed = false;
  /**
   * What the next project check covers: files whose text changed (then only what imports them),
   * or everything (the first check, a file created or deleted).
   */
  private readonly _changedSinceCheck = new Set<string>();
  private _fullCheck = true;
  private readonly _onDidChangeOwners = new Emitter<void>();

  /** A worker plugin was loaded or unloaded (item owners may have changed). */
  readonly onDidChangeOwners: Event<void> = this._onDidChangeOwners.event;

  constructor(private readonly _options: CodeServiceOptions) {}

  /**
   * The engine, started (and the project mirrored) on first call. A start that fails, or a
   * worker that crashes, is forgotten: the next call starts a new worker.
   */
  engine(): Promise<Remote<EngineApi>> {
    if (!this._engine) {
      const started = new DisposableStore();
      const engine = this._start(started);
      this._engine = engine;
      engine.catch(() => {
        if (this._engine === engine) this._stop(started);
      });
    }
    return this._engine;
  }

  async analyze<T = unknown>(path: string, analyzerId: string, args?: unknown): Promise<T> {
    const engine = await this._current(path);
    return (await engine.analyze(path, analyzerId, args)) as T;
  }

  /** Edits a transformer wants, as offsets in the file's current text (open documents included). */
  async transform(path: string, transformerId: string, op: unknown): Promise<TextEdit[]> {
    return (await this._current(path)).transform(path, transformerId, op);
  }

  /**
   * An undoable command applying a transformer's edits through the DocumentService (the open
   * editor if any). Returns undefined when the transformer changes nothing.
   */
  async edit(
    path: string,
    transformerId: string,
    op: unknown,
    options: { label: string; origin?: CommandOrigin; mergeKey?: string },
  ): Promise<HistoryCommand | undefined> {
    const engine = await this.engine();
    const text = await this._options.documents.getText(path);
    await engine.setFiles([{ path, text }]);
    const edits = await engine.transform(path, transformerId, op);
    if (!edits.length) return undefined;
    return this._options.documents.editCommand(path, edits, {
      ...options,
      basedOn: fingerprint(text),
    });
  }

  /** Checks files now and publishes TypeScript problems. */
  /** Edits organizing the imports of a code file (current content, open documents included). */
  async organizeImports(path: string): Promise<TextEdit[]> {
    const engine = await this.engine();
    await engine.setFiles([{ path, text: await this._options.documents.getText(path) }]);
    return engine.organizeImports(path);
  }

  /** Named declarations of a code file's current text (open documents included). */
  async symbols(path: string): Promise<CodeSymbol[]> {
    return (await this._current(path)).symbols(path);
  }

  /** Type declarations of a package as resolved from a file (node_modules lookup). */
  typeFiles(module: string, from: string): Promise<readonly { path: string; text: string }[]> {
    return this._options.rpc
      .api(CodeContract)
      .typeFiles({ project: this._options.projectId, from, module });
  }

  /** Formats a file's text with Prettier (see `code.format`). */
  format(
    path: string,
    text: string,
  ): Promise<{ text: string; formatter: 'project' | 'bundled' | 'none' }> {
    return this._options.rpc
      .api(CodeContract)
      .format({ project: this._options.projectId, path, text });
  }

  async refreshDiagnostics(paths: readonly string[]): Promise<readonly CodeDiagnostic[]> {
    const diagnostics = await (await this.engine()).diagnostics(paths);
    const byPath = new Map<string, CodeDiagnostic[]>(paths.map((path) => [path, []]));
    for (const diagnostic of diagnostics) byPath.get(diagnostic.path)?.push(diagnostic);
    this._options.diagnostics.setMany('typescript', byPath);
    return diagnostics;
  }

  /** Keeps TypeScript problems of a file up to date while watched (open editors). */
  watchDiagnostics(path: string): Disposable {
    this._watched.add(path);
    this._scheduleDiagnostics(path, false);
    return {
      dispose: () => {
        this._watched.delete(path);
        if (!this._projectChecks) this._options.diagnostics.clear('typescript', path);
      },
    };
  }

  /**
   * Keeps the TypeScript problems of every code file of the project up to date, not only of
   * watched files, until disposed (the Problems panel). Files are checked when it starts and
   * again after changes: a change in one file can break another.
   */
  checkProject(): Disposable {
    if (this._projectChecks++ === 0) {
      this._fullCheck = true;
      this._scheduleProjectCheck(0);
    }
    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        if (--this._projectChecks > 0) return;
        clearTimeout(this._projectCheckTimer);
        this._projectCheckRun++;
        for (const path of this._options.diagnostics.uris('typescript')) {
          if (!this._watched.has(path)) this._options.diagnostics.clear('typescript', path);
        }
      },
    };
  }

  /** Items of a source (ADR 0003), extracted by the worker with the registered owners. */
  async extractMeta(request: MetaRequest): Promise<MetaResponse> {
    return (await this.engine()).extractMeta(request);
  }

  /** Item owners registered by worker plugins (name, version, schema). */
  async itemOwners(): Promise<{ name: string; version: string; schema: number }[]> {
    return (await this.engine()).itemOwners();
  }

  /** Loads a plugin's worker entry (`entry.worker`); reloading replaces its registrations. */
  async loadWorkerPlugin(owner: string, url: string): Promise<void> {
    this._plugins.set(owner, url);
    try {
      if (this._engine) await (await this._engine).loadPlugin(owner, url);
    } finally {
      this._onDidChangeOwners.fire();
    }
  }

  async unloadWorkerPlugin(owner: string): Promise<void> {
    this._plugins.delete(owner);
    try {
      if (this._engine) await (await this._engine).unloadPlugin(owner);
    } finally {
      this._onDidChangeOwners.fire();
    }
  }

  dispose(): void {
    this._disposed = true;
    clearTimeout(this._diagnosticsTimer);
    clearTimeout(this._projectCheckTimer);
    this._projectCheckRun++;
    this._store.dispose();
    this._onDidChangeOwners.dispose();
    this._endpoint?.terminate?.();
  }

  /** The engine, with the file's current text mirrored (the change stream may lag). */
  private async _current(path: string): Promise<Remote<EngineApi>> {
    const engine = await this.engine();
    await engine.setFiles([{ path, text: await this._options.documents.getText(path) }]);
    return engine;
  }

  /** Stops a worker that failed, and what was set up for it. */
  private _stop(started: DisposableStore): void {
    this._engine = undefined;
    this._store.delete(started);
    started.dispose();
    this._endpoint?.terminate?.();
    this._endpoint = undefined;
  }

  private async _start(started: DisposableStore): Promise<Remote<EngineApi>> {
    mark('nf:code:created');
    const endpoint = this._options.createWorker();
    this._endpoint = endpoint;
    this._store.add(started);
    const onError = () => {
      if (this._endpoint === endpoint) this._stop(started);
    };
    endpoint.addEventListener('error', onError);
    started.add({ dispose: () => endpoint.removeEventListener('error', onError) });
    const host: EngineHostApi = {
      resolveTypes: (module, from) =>
        this._options.rpc
          .api(CodeContract)
          .typeFiles({ project: this._options.projectId, from, module }),
      typesFailed: (module, from, message) =>
        this._options.logger?.warn(
          `The types of ${module} (imported by ${from}) could not be read: ${message}`,
        ),
    };
    started.add({ dispose: expose(host, endpoint) });
    const engine = wrap<EngineApi>(endpoint);
    started.add({ dispose: () => engine.dispose() });

    const syncTsconfig = async () =>
      engine.setTsconfig(
        this._options.fs.entry(TSCONFIG)
          ? await this._options.documents.getText(TSCONFIG).catch(() => undefined)
          : undefined,
      );
    await syncTsconfig();
    mark('nf:code:ready', 'nf:code:created');
    started.add(
      this._options.fs.onDidChange((changes) => {
        if (changes.some((change) => DEPENDENCIES.test(change.path))) {
          void engine
            .forgetMissingTypes()
            .then(() => {
              this._fullCheck = true;
              this._scheduleProjectCheck();
              for (const path of this._watched) this._scheduleDiagnostics(path, false);
            })
            .catch(() => undefined);
        }
        if (!changes.some((change) => change.path === TSCONFIG)) return;
        void syncTsconfig()
          .then(() => {
            this._fullCheck = true;
            this._scheduleProjectCheck();
          })
          .catch((error: unknown) =>
            this._options.logger?.warn('tsconfig.json could not be applied', error),
          );
      }),
    );

    const paths = this._options.fs.entries.filter(
      (entry) => entry.kind === 'file' && isCodeFile(entry.path),
    );
    for (let i = 0; i < paths.length; i += 32) {
      const batch = await Promise.all(
        paths.slice(i, i + 32).map(async (entry) => ({
          path: entry.path,
          text: await this._options.documents.getText(entry.path),
        })),
      );
      await engine.setFiles(batch);
    }
    mark('nf:code:mirrored', 'nf:code:created');
    started.add(
      this._options.fs.onDidChange((changes) => {
        void (async () => {
          const deleted = changes
            .filter((change) => change.type === 'deleted' && isCodeFile(change.path))
            .map((change) => change.path);
          if (deleted.length) await engine.deleteFiles(deleted);
          const updated = changes.filter(
            (change) =>
              change.type !== 'deleted' &&
              change.kind === 'file' &&
              isCodeFile(change.path) &&
              !this._options.documents.get(change.path),
          );
          if (updated.length) {
            await engine.setFiles(
              await Promise.all(
                updated.map(async (change) => ({
                  path: change.path,
                  text: await this._options.documents.getText(change.path),
                })),
              ),
            );
          }
          for (const path of deleted) this._scheduleDiagnostics(path, true, true);
          for (const change of updated)
            this._scheduleDiagnostics(change.path, true, change.type === 'created');
        })().catch((error: unknown) =>
          this._options.logger?.warn('Code mirror update failed', error),
        );
      }),
    );
    started.add(
      this._options.documents.onDidChange(({ uri }) => {
        if (!isCodeFile(uri)) return;
        void this._options.documents
          .getText(uri)
          .then((text) => engine.setFiles([{ path: uri, text }]))
          .then(() => this._scheduleDiagnostics(uri))
          .catch((error: unknown) =>
            this._options.logger?.warn(`Code mirror of ${uri} failed`, error),
          );
      }),
    );
    for (const [owner, url] of this._plugins) {
      await engine
        .loadPlugin(owner, url)
        .catch((error: unknown) =>
          this._options.logger?.error(`Worker plugin ${owner} failed`, error),
        );
    }
    if (this._plugins.size) this._onDidChangeOwners.fire();
    return engine;
  }

  private _scheduleProjectCheck(delayMs = 1500): void {
    if (!this._projectChecks || this._disposed) return;
    clearTimeout(this._projectCheckTimer);
    this._projectCheckTimer = setTimeout(() => {
      this._checkProject().catch((error: unknown) =>
        this._options.logger?.warn('Project check failed', error),
      );
    }, delayMs);
  }

  private async _checkProject(): Promise<void> {
    const run = ++this._projectCheckRun;
    const engine = await this.engine();
    const all = this._options.fs.entries
      .filter(
        (entry) => entry.kind === 'file' && isCodeFile(entry.path) && !NOT_CHECKED.test(entry.path),
      )
      .map((entry) => entry.path);
    const changed = [...this._changedSinceCheck];
    /** Declarations that reach files without imports (augmentations, globals) can break any. */
    const wasFull = this._fullCheck;
    /** Reset before awaiting: changes recorded meanwhile belong to the next check. */
    this._fullCheck = false;
    this._changedSinceCheck.clear();
    const full = wasFull || (await this._declaresGlobally(changed));
    /** A newer run cut this one short: it takes over what was left. */
    const handOver = () => {
      if (full) this._fullCheck = true;
      else for (const path of changed) this._changedSinceCheck.add(path);
      this._scheduleProjectCheck();
    };
    if (run !== this._projectCheckRun) return handOver();
    let paths = all;
    if (!full) {
      const affected = new Set([...changed, ...(await engine.dependents(changed))]);
      paths = all.filter((path) => affected.has(path));
    } else {
      const checked = new Set(all);
      for (const path of this._options.diagnostics.uris('typescript')) {
        if (!checked.has(path) && !this._watched.has(path))
          this._options.diagnostics.clear('typescript', path);
      }
    }
    for (let index = 0; index < paths.length; index += CHECK_BATCH) {
      if (run !== this._projectCheckRun) return handOver();
      await this.refreshDiagnostics(paths.slice(index, index + CHECK_BATCH));
    }
  }

  private async _declaresGlobally(paths: readonly string[]): Promise<boolean> {
    for (const path of paths) {
      if (path.endsWith('.d.ts')) return true;
      const text = await this._options.documents.getText(path).catch(() => '');
      if (/\bdeclare\s+(module|global)\b/.test(text)) return true;
    }
    return false;
  }

  /** `structural`: the file was created or deleted, which can change what any file resolves. */
  private _scheduleDiagnostics(path: string, changed = true, structural = false): void {
    if (changed && this._projectChecks) {
      if (structural) this._fullCheck = true;
      else this._changedSinceCheck.add(path);
      this._scheduleProjectCheck();
    }
    if (!this._watched.has(path) && !(this._projectChecks && !NOT_CHECKED.test(path))) return;
    this._pendingDiagnostics.add(path);
    clearTimeout(this._diagnosticsTimer);
    this._diagnosticsTimer = setTimeout(() => {
      const paths = [...this._pendingDiagnostics];
      this._pendingDiagnostics.clear();
      this.refreshDiagnostics(paths).catch((error: unknown) =>
        this._options.logger?.warn('Diagnostics failed', error),
      );
    }, this._options.diagnosticsDelayMs ?? 300);
  }
}

export const CodeServiceToken = createToken<CodeService>('code.service');
