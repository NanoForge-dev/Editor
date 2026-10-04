import { DocumentServiceToken } from '@nanoforge-dev/editor-code';
import type { HistoryContext, HistoryService } from '@nanoforge-dev/editor-history';
import {
  type Container,
  CoreServices,
  type Disposable,
  DisposableStore,
  type Observable,
  ObservableValue,
  createToken,
} from '@nanoforge-dev/editor-kernel';
import {
  type ClientProject,
  EDITOR_LIBRARY,
  type NewApp,
  type NewLibrary,
  type ProjectService,
  type Undo,
  WorkspaceError,
  type WorkspaceIo,
  addEditorLibrary,
  createApp,
  createLibrary,
  removeApp,
  removeLibrary,
  renameApp,
  renameLibrary,
  runnableApps,
  setLibraryUse,
  validatePackageName,
  workspaceIo,
} from '@nanoforge-dev/editor-project';
import { type AppModel, ProjectsContract } from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';
import type { NotificationService, PromptService } from '@nanoforge-dev/editor-ui';

/** Undo and redo target of the Project screen: changes of the workspace. */
export const PROJECT_HISTORY_CONTEXT = 'project';

/** A dialog the Project screen is asked to show. */
export type WorkspaceRequest =
  | { readonly kind: 'library' }
  | { readonly kind: 'app'; readonly type: 'client' | 'server' }
  | { readonly kind: 'remove'; readonly app: AppModel };

export interface WorkspaceActionsOptions {
  readonly services: Container;
  readonly projects: ProjectService;
  readonly rpc: RpcClient;
  readonly history: HistoryService;
  readonly notifications: NotificationService;
  readonly prompts: PromptService;
  /** Local editors install dependencies; hosted ones never run project tools. */
  readonly local: boolean;
}

/**
 * What the Project screen does to the workspace: add, rename and remove apps and shared
 * libraries, and choose which apps use a library. Each action is one step of the Project
 * history; failures are reported, never thrown.
 */
export class WorkspaceActions implements Disposable {
  private readonly _store = new DisposableStore();
  private readonly _request = new ObservableValue<WorkspaceRequest | undefined>(undefined);
  private readonly _stack: HistoryContext['stack'];
  private readonly _hasSteps = new ObservableValue(false);

  constructor(private readonly _options: WorkspaceActionsOptions) {
    const context = this._store.add(
      _options.history.registerContext({
        id: PROJECT_HISTORY_CONTEXT,
        label: 'Project',
        owner: 'core',
      }),
    );
    this._stack = context.stack;
    this._store.add(
      context.stack.onDidChange(({ canUndo, canRedo }) => this._hasSteps.set(canUndo || canRedo)),
    );
    const commands = _options.services.get(CoreServices.Commands);
    const open = (request: WorkspaceRequest) => async () => {
      await commands.execute('workbench.openWidget', 'core.project');
      this._request.set(request);
    };
    for (const [id, title, request] of [
      ['project.addLibrary', 'Add shared library…', { kind: 'library' }],
      ['project.addClientApp', 'Add client app…', { kind: 'app', type: 'client' }],
      ['project.addServerApp', 'Add server app…', { kind: 'app', type: 'server' }],
    ] as const)
      this._store.add(
        commands.register({ id, title, category: 'Project', handler: open(request) }),
      );
  }

  /**
   * Whether the Project history has a step to undo or redo. The screen is the target of undo
   * only then: with none, `Ctrl+Z` there keeps undoing the layout, as on a screen without history.
   */
  get hasSteps(): Observable<boolean> {
    return this._hasSteps.readonly();
  }

  /** The dialog asked for (by a command, or a button of the screen). */
  get request(): Observable<WorkspaceRequest | undefined> {
    return this._request.readonly();
  }

  ask(request: WorkspaceRequest | undefined): void {
    this._request.set(request);
  }

  get local(): boolean {
    return this._options.local;
  }

  /** The apps a new library is used by, and that can use one: the clients and servers. */
  apps(): AppModel[] {
    const project = this._project();
    return project ? runnableApps(project.model.get()) : [];
  }

  addLibrary(library: NewLibrary): Promise<boolean> {
    return this._run(`Add shared library ${library.packageName}`, (io) =>
      createLibrary(io, library),
    );
  }

  async addApp(app: NewApp): Promise<boolean> {
    const added = await this._run(`Add ${app.type} app ${app.name}`, (io, project) =>
      createApp(io, project.model.get(), app),
    );
    if (added && !app.from) this._offerInstall(app.name);
    return added;
  }

  /**
   * Makes an app use a library, or stop. A library no app lists yet is given to them all: the
   * first choice writes it down for every app that keeps it.
   */
  setUse(app: AppModel, library: AppModel, used: boolean): Promise<boolean> {
    return this._run(
      `${used ? 'Use' : 'Stop using'} ${library.name} in ${app.name}`,
      async (io, project) => {
        const undos: Undo[] = [];
        if (library.unclaimed && !used) {
          for (const other of runnableApps(project.model.get()))
            if (other.id !== app.id) undos.push(await setLibraryUse(io, other, library, true));
        }
        undos.push(await setLibraryUse(io, app, library, used));
        return async () => {
          for (const undo of undos.reverse()) await undo();
        };
      },
    );
  }

  /** Asks for the new package name of an app or a library, then renames it. */
  async rename(app: AppModel): Promise<boolean> {
    const project = this._project();
    if (!project) return false;
    const name = await this._options.prompts.ask({
      title: `Rename ${app.name}`,
      label: app.type === 'lib' ? 'Package name (how apps import it)' : 'Name',
      value: app.name,
      confirm: 'Rename',
      validate: (value) =>
        validatePackageName(value) ??
        (value !== app.name && project.model.get().apps.some((other) => other.name === value)
          ? `${value} is already the name of an app or library.`
          : undefined),
    });
    if (!name || name === app.name) return false;
    if (app.type === 'lib') {
      const failed = await this._options.services.tryGet(DocumentServiceToken)?.saveAll();
      if (failed?.length) {
        this._options.notifications.notify('error', `Could not save ${failed[0]!.uri}`, {
          detail: 'Save or revert it, then rename the library again.',
        });
        return false;
      }
    }
    return this._run(`Rename ${app.name} to ${name}`, (io) =>
      app.type === 'lib'
        ? renameLibrary(io, project.model.get(), app, name)
        : renameApp(io, project.model.get(), app, name),
    );
  }

  remove(app: AppModel): Promise<boolean> {
    return this._run(`Remove ${app.name}`, (io, project) =>
      app.type === 'lib'
        ? removeLibrary(io, project.model.get(), app)
        : removeApp(io, project.model.get(), app),
    );
  }

  /**
   * Registers the engine's editor library in an app (its `package.json` and entry file), so
   * the editor can pause it and show it live. It takes effect at the next Play.
   */
  async addEditorLibrary(app: AppModel): Promise<boolean> {
    const added = await this._run(`Add the editor library to ${app.name}`, (io) =>
      addEditorLibrary(io, app),
    );
    if (!added) return false;
    if (EDITOR_LIBRARY in app.engineLibs) {
      this._options.notifications.notify('info', `${app.name} registers the editor library`, {
        detail: 'Play again to use it.',
      });
    } else
      this._offerInstall(
        app.name,
        'It now depends on @nanoforge-dev/editor-lib: install it, then play again.',
      );
    return true;
  }

  /** Whether the folder of an app can be shown in the machine's file manager. */
  get canReveal(): boolean {
    return (
      this._options.local &&
      this._options.services.get(CoreServices.Commands).has('fileManager.reveal')
    );
  }

  reveal(app: AppModel): void {
    void this._options.services.get(CoreServices.Commands).execute('fileManager.reveal', app.root);
  }

  /** Runs the project's package manager; its output goes to the Console. */
  async install(): Promise<void> {
    const project = this._project();
    if (!project) return;
    const { notifications } = this._options;
    try {
      const { manager, ok } = await this._options.rpc
        .api(ProjectsContract)
        .install({ id: project.id });
      if (!manager) {
        notifications.notify('info', 'Install the dependencies yourself', {
          detail:
            "The project has no lockfile, so the editor can't tell which package manager it uses. Run its install command in the project's folder.",
          timeout: 0,
        });
      } else if (ok) notifications.notify('info', `Dependencies installed with ${manager}`);
      else
        notifications.notify('error', `${manager} install failed`, {
          detail: 'Its output is in the Console, under Tasks.',
        });
    } catch (error) {
      notifications.notify('error', 'Could not install the dependencies', {
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  dispose(): void {
    this._store.dispose();
  }

  private _project(): ClientProject | undefined {
    return this._options.projects.current.get();
  }

  private _offerInstall(
    name: string,
    detail = 'A new app has no node_modules yet: install them before playing it.',
  ): void {
    if (!this._options.local) return;
    this._options.notifications.notify('info', `${name} needs its dependencies`, {
      detail,
      actions: [{ title: 'Install dependencies', run: () => this.install() }],
      timeout: 0,
    });
  }

  /** One undoable step of the Project history; a refusal is shown with the files in the way. */
  private async _run(
    label: string,
    operation: (io: WorkspaceIo, project: ClientProject) => Promise<Undo>,
  ): Promise<boolean> {
    const project = this._project();
    if (!project) return false;
    const io = workspaceIo(project);
    let undo: Undo | undefined;
    try {
      await this._stack.push({
        label,
        do: async () => {
          undo = await operation(io, project);
          await project.fs.refresh();
        },
        undo: async () => {
          await undo?.();
          await project.fs.refresh();
        },
      });
      return true;
    } catch (error) {
      const paths = error instanceof WorkspaceError ? error.paths : [];
      this._options.notifications.notify('error', `${label}: not possible`, {
        detail: `${error instanceof Error ? error.message : String(error)}${
          paths.length
            ? ` (${paths.slice(0, 5).join(', ')}${paths.length > 5 ? `, and ${paths.length - 5} more` : ''})`
            : ''
        }`,
      });
      return false;
    }
  }
}

export const WorkspaceActionsToken = createToken<WorkspaceActions>('editor.workspaceActions');
