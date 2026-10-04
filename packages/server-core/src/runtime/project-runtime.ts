import { basename, isAbsolute, join, relative } from 'node:path';

import {
  type Disposable,
  DisposableStore,
  Emitter,
  type Event,
  type Logger,
} from '@nanoforge-dev/editor-kernel';
import {
  type AppModel,
  type OutputManifest,
  type RuntimeEvent,
  runtimeOutputPath,
} from '@nanoforge-dev/editor-protocol';
import { RpcError } from '@nanoforge-dev/editor-rpc';

import type { EditorEnv } from '../env/editor-env.type';
import type { CliRun, CliService } from '../process/cli-service';
import type { OpenProject } from '../project/project-registry';
import { ANSI, BuildOrchestrator } from './build-orchestrator';
import { BuildOutput } from './build-output';
import { loadGameEnv } from './game-env';
import { GameServerProcess } from './game-server';

/** File name bun gives to the bundle of an entry (`src/main.ts` → `main.js`). */
export const outputEntry = (app: AppModel): string =>
  basename(app.editorEntryFile ?? app.entryFile ?? 'main.ts').replace(/\.[cm]?[jt]sx?$/, '.js');

/** Builds, outputs and game servers of one project. */
export class ProjectRuntime implements Disposable {
  readonly builds: BuildOrchestrator;
  private readonly _servers = new Map<string, GameServerProcess>();
  private readonly _onEvent = new Emitter<RuntimeEvent>();
  private readonly _store = new DisposableStore();

  readonly onEvent: Event<RuntimeEvent> = this._onEvent.event;

  constructor(
    readonly project: OpenProject,
    cli: CliService,
    private readonly _env: EditorEnv,
    private readonly _logger: Logger,
  ) {
    this.builds = this._store.add(new BuildOrchestrator(project, cli, _logger));
    this._store.add(this.builds.onEvent((event) => this._onEvent.fire(event)));
    this._store.add(cli.onDidStart((run) => this._followTask(run)));
  }

  app(id: string): AppModel {
    const app = this.builds.app(id);
    if (!app) throw new RpcError('NOT_FOUND', `No runnable app ${id || '(root)'}`);
    return app;
  }

  async manifest(appId: string): Promise<OutputManifest> {
    const app = this.app(appId);
    const files = await this.builds.output(app).files();
    const entry = outputEntry(app);
    if (!files.some((file) => file.path === entry)) {
      throw new RpcError('NOT_FOUND', `${app.name} has no build output yet`);
    }
    return {
      app: app.id,
      version: BuildOutput.version(files),
      baseUrl: runtimeOutputPath(this.project.id, app.id),
      entry,
      files,
    };
  }

  env(appId: string, overrides: Record<string, string> = {}): Promise<Record<string, string>> {
    const app = this.app(appId);
    return loadGameEnv(this.project.root, app.type === 'server' ? 'server' : 'client', overrides);
  }

  /** Starts the game server of an app (restarts it when running). */
  async startServer(appId: string, overrides: Record<string, string> = {}): Promise<void> {
    const app = this.app(appId);
    if (app.type !== 'server') throw new RpcError('BAD_REQUEST', `${app.name} is not a server`);
    await this.stopServer(appId);
    const manifest = await this.manifest(appId);
    const outDir = this.builds.output(app).dir;
    const server = new GameServerProcess({
      app: app.id,
      cwd: join(this.project.root, app.root),
      main: join(outDir, manifest.entry),
      files: Object.fromEntries(
        manifest.files.map((file) => [`/${file.path}`, join(outDir, file.path)]),
      ),
      env: await this.env(appId, overrides),
      dataDir: this._env.dataDir,
    });
    this._servers.set(app.id, server);
    const forward = server.onEvent((event) => {
      this._onEvent.fire(event);
      if (event.type === 'server' && event.state === 'exited') {
        forward.dispose();
        if (this._servers.get(app.id) === server) this._servers.delete(app.id);
      }
    });
    await server.start();
    this._logger.info(`Started the game server of ${app.name}`);
  }

  async stopServer(appId: string): Promise<void> {
    await this._servers.get(appId)?.stop();
  }

  sendServer(appId: string, event: string, args: readonly unknown[]): void {
    const server = this._servers.get(appId);
    if (!server) throw new RpcError('NOT_FOUND', `The game server of ${appId} is not running`);
    server.send(event, args);
  }

  servers(): { app: string; state: GameServerProcess['state'] }[] {
    return [...this._servers].map(([app, server]) => ({ app, state: server.state }));
  }

  dispose(): void {
    for (const server of this._servers.values()) server.kill();
    this._servers.clear();
    this._store.dispose();
    this._onEvent.dispose();
  }

  /** Streams a CLI run made in this project (other than builds) as a console task. */
  private _followTask(run: CliRun): void {
    const inside = relative(this.project.root, run.cwd);
    if (run.silent || inside.startsWith('..') || isAbsolute(inside)) return;
    const app = `${run.command} ${run.args.join(' ')}`;
    const log = (stream: 'stdout' | 'stderr', text: string) =>
      this._onEvent.fire({ type: 'log', app, source: 'cli', stream, text });
    log('stdout', `$ ${app}`);
    const listener = run.onLine(({ stream, text }) => log(stream, text.replace(ANSI, '')));
    run.done
      .then(({ exitCode }) => {
        if (exitCode !== 0) log('stderr', `error: ${app} exited with code ${exitCode}`);
      })
      .catch((error: unknown) =>
        log('stderr', `error: ${error instanceof Error ? error.message : String(error)}`),
      )
      .finally(() => listener.dispose());
  }
}

/** One runtime per open project, created on first use. */
export class RuntimeManager implements Disposable {
  private readonly _runtimes = new Map<string, ProjectRuntime>();

  constructor(
    private readonly _cli: CliService,
    private readonly _env: EditorEnv,
    private readonly _logger: Logger,
  ) {}

  get(project: OpenProject): ProjectRuntime {
    let runtime = this._runtimes.get(project.id);
    if (!runtime) {
      runtime = new ProjectRuntime(project, this._cli, this._env, this._logger);
      this._runtimes.set(project.id, runtime);
    }
    return runtime;
  }

  dispose(): void {
    for (const runtime of this._runtimes.values()) runtime.dispose();
    this._runtimes.clear();
  }
}
