import { isAbsolute, join, relative, sep } from 'node:path';

import {
  type Disposable,
  Emitter,
  type Event,
  type Logger,
  type Observable,
  toDisposable,
} from '@nanoforge-dev/editor-kernel';
import type {
  AppModel,
  BuildDiagnostic,
  BuildStatus,
  FileChange,
  ProjectModel,
  RuntimeEvent,
} from '@nanoforge-dev/editor-protocol';

import type { CliService } from '../process/cli-service';
import { KeyedMutex } from '../util/keyed-mutex';
import { BuildOutput } from './build-output';

/** The parts of an open project the orchestrator needs. */
export interface BuildableProject {
  readonly root: string;
  readonly model: Observable<ProjectModel>;
  readonly watcher: { readonly onDidChange: Event<FileChange[]> };
}

// eslint-disable-next-line no-control-regex -- terminal color codes
export const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
const REBUILD_DELAY_MS = 150;

/** Apps the editor can build and run: clients and servers with an output directory. */
export const runnableApps = (model: ProjectModel): AppModel[] =>
  model.apps.filter((app) => app.type !== 'lib' && app.outDir !== undefined);

/**
 * Reads bun build errors from the CLI output:
 * `error: <message>` followed by `    at <file>:<line>:<column>`.
 */
export const parseBuildOutput = (output: string, projectRoot: string): BuildDiagnostic[] => {
  const diagnostics: BuildDiagnostic[] = [];
  const lines = output.replace(ANSI, '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const match = /^\s*(error|warn|warning): (.+)$/.exec(lines[index]!);
    if (!match) continue;
    const diagnostic: BuildDiagnostic = {
      message: match[2]!.trim(),
      severity: match[1] === 'error' ? 'error' : 'warning',
    };
    const location = /^\s*at (.+):(\d+):(\d+)\s*$/.exec(lines[index + 1] ?? '');
    if (location) {
      const file = relative(projectRoot, location[1]!);
      diagnostics.push({
        ...diagnostic,
        ...(!file.startsWith('..') && !isAbsolute(file) && { path: file.split(sep).join('/') }),
        line: Number(location[2]),
        column: Number(location[3]),
      });
      index++;
    } else diagnostics.push(diagnostic);
  }
  return diagnostics;
};

/**
 * Builds the apps of a project with `nf build --editor`, one app at a time, and keeps their
 * status. While watched, apps are rebuilt when their sources change (a change outside of every
 * app, e.g. in a shared lib or the root config, rebuilds them all).
 */
export class BuildOrchestrator implements Disposable {
  private readonly _statuses = new Map<string, BuildStatus>();
  private readonly _outputs = new Map<string, BuildOutput>();
  private readonly _onEvent = new Emitter<RuntimeEvent>();
  private readonly _mutex = new KeyedMutex();
  private readonly _dirty = new Set<string>();
  private _watchers = 0;
  private _watch: Disposable | undefined;
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _disposed = false;

  readonly onEvent: Event<RuntimeEvent> = this._onEvent.event;

  constructor(
    private readonly _project: BuildableProject,
    private readonly _cli: CliService,
    private readonly _logger: Logger,
  ) {}

  get apps(): AppModel[] {
    return runnableApps(this._project.model.get());
  }

  app(id: string): AppModel | undefined {
    return this.apps.find((app) => app.id === id);
  }

  status(app: string): BuildStatus {
    return (
      this._statuses.get(app) ?? {
        app,
        state: 'idle',
        version: null,
        diagnostics: [],
        finishedAt: null,
        durationMs: null,
      }
    );
  }

  /** Output directory of an app, with content hashes. */
  output(app: AppModel): BuildOutput {
    const dir = join(this._project.root, app.outDir ?? 'dist');
    let output = this._outputs.get(app.id);
    if (output?.dir !== dir) {
      output = new BuildOutput(dir);
      this._outputs.set(app.id, output);
    }
    return output;
  }

  /** Builds the given apps (all runnable apps by default), after any build in progress. */
  build(ids?: readonly string[]): Promise<BuildStatus[]> {
    const apps = ids ? this.apps.filter((app) => ids.includes(app.id)) : this.apps;
    for (const app of apps) this._dirty.delete(app.id);
    return this._mutex.run('build', async () => {
      const statuses: BuildStatus[] = [];
      for (const app of apps) {
        if (this._disposed) break;
        statuses.push(await this._buildApp(app));
      }
      return statuses;
    });
  }

  /** Rebuilds apps on source changes until the returned disposable is disposed. */
  watch(): Disposable {
    if (this._watchers++ === 0) {
      this._watch = this._project.watcher.onDidChange((changes) => this._onChanges(changes));
    }
    return toDisposable(() => {
      if (--this._watchers > 0) return;
      this._watch?.dispose();
      this._watch = undefined;
      clearTimeout(this._timer);
    });
  }

  dispose(): void {
    this._disposed = true;
    clearTimeout(this._timer);
    this._watch?.dispose();
    this._onEvent.dispose();
  }

  private _onChanges(changes: readonly FileChange[]): void {
    const apps = this.apps;
    const roots = this._project.model.get().apps.map((app) => app.root);
    for (const { path } of changes) {
      if (path.startsWith('.nanoforge/')) continue;
      const owner = roots
        .filter((root) => root === '' || path === root || path.startsWith(`${root}/`))
        .sort((a, b) => b.length - a.length)[0];
      const affected = apps.filter((app) => owner !== undefined && app.root === owner);
      for (const app of affected.length ? affected : apps) this._dirty.add(app.id);
    }
    if (!this._dirty.size) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      const dirty = [...this._dirty];
      this.build(dirty).catch((error: unknown) => this._logger.error('Rebuild failed', error));
    }, REBUILD_DELAY_MS);
  }

  private _setStatus(status: BuildStatus): BuildStatus {
    this._statuses.set(status.app, status);
    this._onEvent.fire({ type: 'build', status });
    return status;
  }

  private async _buildApp(app: AppModel): Promise<BuildStatus> {
    const previous = this.status(app.id);
    this._setStatus({ ...previous, state: 'building' });
    const started = Date.now();
    const run = this._cli.run(['build', '--editor', '--directory', app.root || '.'], {
      cwd: this._project.root,
      env: { FORCE_COLOR: '0', NO_COLOR: '1' },
      silent: true,
    });
    const listener = run.onLine(({ stream, text }) =>
      this._onEvent.fire({
        type: 'log',
        app: app.id,
        source: 'build',
        stream,
        text: text.replace(ANSI, ''),
      }),
    );
    let exitCode: number;
    let output: string;
    try {
      const result = await run.done;
      exitCode = result.exitCode;
      output = `${result.stdout}\n${result.stderr}`;
    } catch (error) {
      exitCode = -1;
      output = `error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      listener.dispose();
    }
    const diagnostics = parseBuildOutput(output, this._project.root);
    const failed = exitCode !== 0 || /Build failed/i.test(output.replace(ANSI, ''));
    if (failed && !diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
      diagnostics.push({ message: `Build of ${app.name} failed`, severity: 'error' });
    }
    const files = failed ? [] : await this.output(app).files();
    return this._setStatus({
      app: app.id,
      state: failed ? 'error' : 'ok',
      version: failed ? previous.version : BuildOutput.version(files),
      diagnostics,
      finishedAt: Date.now(),
      durationMs: Date.now() - started,
    });
  }
}
