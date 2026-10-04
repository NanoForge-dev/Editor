import type { CommandOrigin, HistoryCommand } from '@nanoforge-dev/editor-history';
import {
  type Disposable,
  DisposableStore,
  type Logger,
  createToken,
} from '@nanoforge-dev/editor-kernel';
import type { ProjectFs } from '@nanoforge-dev/editor-project';
import { CodeContract } from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';

import type { DiagnosticsService } from '../diagnostics/diagnostics-service';
import type { DocumentService } from '../document/document-service';
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

  constructor(private readonly _options: CodeServiceOptions) {}

  /** The engine, started (and the project mirrored) on first call. */
  engine(): Promise<Remote<EngineApi>> {
    this._engine ??= this._start();
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
    const edits = await this.transform(path, transformerId, op);
    return edits.length ? this._options.documents.editCommand(path, edits, options) : undefined;
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
    for (const path of paths) {
      this._options.diagnostics.set(
        'typescript',
        path,
        diagnostics.filter((diagnostic) => diagnostic.path === path),
      );
    }
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
    if (this._projectChecks++ === 0) this._scheduleProjectCheck(0);
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
    if (this._engine) await (await this._engine).loadPlugin(owner, url);
  }

  async unloadWorkerPlugin(owner: string): Promise<void> {
    this._plugins.delete(owner);
    if (this._engine) (await this._engine).unloadPlugin(owner);
  }

  dispose(): void {
    clearTimeout(this._diagnosticsTimer);
    clearTimeout(this._projectCheckTimer);
    this._projectCheckRun++;
    this._store.dispose();
    this._endpoint?.terminate?.();
  }

  /** The engine, with the file's current text mirrored (the change stream may lag). */
  private async _current(path: string): Promise<Remote<EngineApi>> {
    const engine = await this.engine();
    await engine.setFiles([{ path, text: await this._options.documents.getText(path) }]);
    return engine;
  }

  private async _start(): Promise<Remote<EngineApi>> {
    mark('nf:code:created');
    const endpoint = this._options.createWorker();
    this._endpoint = endpoint;
    const host: EngineHostApi = {
      resolveTypes: (module, from) =>
        this._options.rpc
          .api(CodeContract)
          .typeFiles({ project: this._options.projectId, from, module }),
    };
    this._store.add({ dispose: expose(host, endpoint) });
    const engine = wrap<EngineApi>(endpoint);
    this._store.add({ dispose: () => engine.dispose() });

    const syncTsconfig = async () =>
      engine.setTsconfig(
        this._options.fs.entry(TSCONFIG)
          ? await this._options.documents.getText(TSCONFIG).catch(() => undefined)
          : undefined,
      );
    await syncTsconfig();
    mark('nf:code:ready', 'nf:code:created');
    this._store.add(
      this._options.fs.onDidChange((changes) => {
        if (changes.some((change) => change.path === TSCONFIG))
          void syncTsconfig().catch((error: unknown) =>
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
    this._store.add(
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
          for (const change of [...deleted.map((path) => ({ path })), ...updated])
            this._scheduleDiagnostics(change.path);
        })().catch((error: unknown) =>
          this._options.logger?.warn('Code mirror update failed', error),
        );
      }),
    );
    this._store.add(
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
    return engine;
  }

  private _scheduleProjectCheck(delayMs = 1500): void {
    if (!this._projectChecks) return;
    clearTimeout(this._projectCheckTimer);
    this._projectCheckTimer = setTimeout(() => {
      this._checkProject().catch((error: unknown) =>
        this._options.logger?.warn('Project check failed', error),
      );
    }, delayMs);
  }

  private async _checkProject(): Promise<void> {
    const run = ++this._projectCheckRun;
    await this.engine();
    const paths = this._options.fs.entries
      .filter(
        (entry) => entry.kind === 'file' && isCodeFile(entry.path) && !NOT_CHECKED.test(entry.path),
      )
      .map((entry) => entry.path);
    const checked = new Set(paths);
    for (const path of this._options.diagnostics.uris('typescript')) {
      if (!checked.has(path) && !this._watched.has(path))
        this._options.diagnostics.clear('typescript', path);
    }
    for (let index = 0; index < paths.length; index += CHECK_BATCH) {
      if (run !== this._projectCheckRun) return;
      await this.refreshDiagnostics(paths.slice(index, index + CHECK_BATCH));
    }
  }

  private _scheduleDiagnostics(path: string, changed = true): void {
    if (changed) this._scheduleProjectCheck();
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
