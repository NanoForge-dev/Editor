import {
  type AppModel,
  CodeServiceToken,
  type Disposable,
  DisposableStore,
  DocumentServiceToken,
  type HistoryCommand,
  type Observable,
  ObservableValue,
  type PluginContext,
  type ProjectModel,
  ProjectServiceToken,
  createToken,
} from '@nanoforge-dev/editor-sdk';
import { NotificationServiceToken } from '@nanoforge-dev/editor-sdk/ui';

import type { EcsLocation, InheritedLocation } from '../extension/ecs-source.extension-point';
import type {
  AppScenesModel,
  LibraryOp,
  ReferenceRange,
  SceneFileOp,
  SceneModel,
} from '../model/scene-model.type';
import {
  CLASSES_ANALYZER,
  LIBRARY_TRANSFORMER,
  REFERENCES_ANALYZER,
  REPLACE_TRANSFORMER,
  SCENES_ANALYZER,
  SCENE_FILE_TRANSFORMER,
  VARS_ANALYZER,
  VARS_FILE,
  VARS_TRANSFORMER,
} from '../model/scene.const';
import type { VarsModel, VarsOp } from '../model/vars-model.type';
import { kebab, scenePath, sceneTemplate } from '../template/scene-template';
import { varsTemplate } from '../template/vars-template';
import { saved } from './saved-command';
import type { Step } from './scene-step.type';
import { SceneSteps } from './scene-steps';

/** The ECS plugin's analyzer and transformer of imports (moving a file). */
const IMPORTERS_ANALYZER = 'ecs.importers';
const REWRITE_IMPORTS_TRANSFORMER = 'ecs.rewrite-imports';

/** The ECS plugin's selected app (a global context key). */
const ACTIVE_APP_KEY = 'activeApp';
const REFRESH_DELAY_MS = 150;

/** Apps whose scenes the plugin edits: an entry file and the scene engine library. */
export const sceneApps = (model: ProjectModel | undefined): AppModel[] =>
  (model?.apps ?? []).filter(
    (app) => app.type !== 'lib' && !!app.entryFile && '@nanoforge-dev/scene' in app.engineLibs,
  );

/** Where a scene's entities are: its class's `setup`. */
export const locationOf = (scene: SceneModel): EcsLocation => ({
  path: scene.path,
  scope: { kind: 'method', class: scene.className, method: 'setup' },
  label: scene.id,
  scene: scene.id,
});

/** The label of the entry file's `main` in the scene tree and the ECS widgets. */
export const MAIN_LABEL = 'main.ts';

/** Where the app's own entities are: its entry file's `main`. */
export const mainLocation = (app: AppModel): EcsLocation | undefined =>
  app.entryFile ? { path: app.entryFile, label: MAIN_LABEL } : undefined;

/** A scene's parents, outermost first (stops at a cycle or an unknown parent). */
export const parentsOf = (scenes: readonly SceneModel[], scene: SceneModel): SceneModel[] => {
  const chain: SceneModel[] = [];
  let parent = scenes.find((candidate) => candidate.className === scene.parent);
  while (parent && !chain.includes(parent) && parent !== scene) {
    chain.unshift(parent);
    const next = parent.parent;
    parent = scenes.find((candidate) => candidate.className === next);
  }
  return chain;
};

/**
 * The scenes of the app the ECS widgets edit (their analysis, the selected one), and what the
 * ECS widgets edit for it (the `ecs.sources` contribution).
 */
export class SceneService implements Disposable {
  private readonly _store = new DisposableStore();
  private readonly _project = new DisposableStore();
  private readonly _projectModel = new ObservableValue<ProjectModel | undefined>(undefined);
  private readonly _appId = new ObservableValue<string | undefined>(undefined);
  private readonly _model = new ObservableValue<AppScenesModel | undefined>(undefined);
  private readonly _vars = new ObservableValue<VarsModel | undefined>(undefined);
  /** The selected scene (class name) of each app. */
  private readonly _selected = new ObservableValue<ReadonlyMap<string, string>>(new Map());
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _generation = 0;

  private readonly _steps: SceneSteps;

  constructor(private readonly _context: PluginContext) {
    this._steps = new SceneSteps(_context, () => this._refresh(0));
    this._store.add(this._project);
    this._store.add({
      dispose: _context.scope.observe(CodeServiceToken).subscribe(() => this._bindProject()),
    });
    this._store.add(
      _context.contextKeys.onDidChange(({ keys }) => {
        if (keys.has(ACTIVE_APP_KEY)) this._pickApp();
      }),
    );
  }

  /** Apps with the scene library. */
  get apps(): AppModel[] {
    return sceneApps(this._projectModel.get());
  }
  get appId(): Observable<string | undefined> {
    return this._appId.readonly();
  }
  get app(): AppModel | undefined {
    return this.apps.find((app) => app.id === this._appId.get());
  }
  /** The scenes of the app. */
  get model(): Observable<AppScenesModel | undefined> {
    return this._model.readonly();
  }
  /** The scene vars of the app: their declaration and uses. */
  get vars(): Observable<VarsModel | undefined> {
    return this._vars.readonly();
  }
  /** The selected scene's class name, per app. */
  get selected(): Observable<ReadonlyMap<string, string>> {
    return this._selected.readonly();
  }

  /** The selected scene of an app. */
  selectedScene(app: AppModel | undefined): SceneModel | undefined {
    const className = app ? this._selected.get().get(app.id) : undefined;
    return app?.id === this._appId.get()
      ? this._model.get()?.scenes.find((scene) => scene.className === className)
      : undefined;
  }

  /** Makes a scene the one the ECS widgets edit. */
  select(className: string | undefined): void {
    const app = this._appId.get();
    if (!app) return;
    const next = new Map(this._selected.get());
    if (className) next.set(app, className);
    else next.delete(app);
    this._selected.set(next);
  }

  /** What the ECS widgets edit for an app: its selected scene's `setup`, else its `main`. */
  current(app: AppModel): Observable<EcsLocation | undefined> {
    const compute = () => {
      const scene = this.selectedScene(app);
      return scene ? locationOf(scene) : mainLocation(app);
    };
    return this._derived(compute);
  }

  /** `main` and the selected scene's parents, outermost first, read-only in the ECS widgets. */
  inherited(app: AppModel): Observable<readonly InheritedLocation[]> {
    const compute = (): InheritedLocation[] => {
      const scene = this.selectedScene(app);
      const scenes = this._model.get()?.scenes ?? [];
      if (!scene) return [];
      const main = mainLocation(app);
      return [
        ...(main ? [{ ...main, label: MAIN_LABEL }] : []),
        ...parentsOf(scenes, scene).map((parent) => ({ ...locationOf(parent), label: parent.id })),
      ];
    };
    return this._derived(compute);
  }

  /** A scene's location, by id (live entities carry it). */
  sceneLocation(app: AppModel, id: string): EcsLocation | undefined {
    if (app.id !== this._appId.get()) return undefined;
    const scene = this._model.get()?.scenes.find((candidate) => candidate.id === id);
    return scene ? locationOf(scene) : undefined;
  }

  /** Creates a scene (its file, and its entry in `scenes`), under a parent or as a root. */
  async newScene(name: string, parent?: SceneModel): Promise<boolean> {
    const app = this.app;
    const project = this._context.services.get(ProjectServiceToken).current.get();
    if (!app?.entryFile || !project) return false;
    const path = scenePath(app, name);
    if (project.fs.entry(path))
      return this._steps.fail(`New scene ${name}`, `${path} already exists.`);
    const text = sceneTemplate(
      app,
      name,
      parent && { className: parent.className, path: parent.path },
    );
    const entry = app.entryFile;
    const ok = await this._steps.push(`New scene ${name}`, [
      async () => ({
        label: `Create ${path}`,
        do: async () => void (await project.fs.write(path, text, { expectedHash: null })),
        undo: async () => void (await project.fs.delete(path)),
      }),
      () => this._libraryStep(entry, { kind: 'addScene', className: name, from: path }),
    ]);
    if (!ok) return false;
    this.select(name);
    await this.openInCode(path, parent ? 11 : 10);
    return true;
  }

  /** Writes `initial` in the entry file. */
  async setInitial(scene: SceneModel): Promise<boolean> {
    const entry = this.app?.entryFile;
    if (!entry) return false;
    return this._steps.push(`Set ${scene.id} as the initial scene`, [
      () =>
        this._steps.edit(entry, LIBRARY_TRANSFORMER, {
          kind: 'setInitial',
          className: scene.className,
          from: scene.path,
        } satisfies LibraryOp),
    ]);
  }

  /** Writes a scene's `static parent` (none: a root scene). */
  async setParent(scene: SceneModel, parent: SceneModel | undefined): Promise<boolean> {
    const scenes = this._model.get()?.scenes ?? [];
    if (parent && (parent === scene || parentsOf(scenes, parent).includes(scene)))
      return this._steps.fail(`Move ${scene.id}`, `${parent.id} is inside ${scene.id}.`);
    return this._steps.push(
      parent ? `Move ${scene.id} under ${parent.id}` : `Move ${scene.id} to the root`,
      [
        () =>
          this._steps.edit(scene.path, SCENE_FILE_TRANSFORMER, {
            kind: 'setParent',
            className: scene.className,
            ...(parent && { parent: { className: parent.className, from: parent.path } }),
          } satisfies SceneFileOp),
      ],
    );
  }

  /**
   * Renames a scene class everywhere it is used, and its file when it is named after it and holds
   * nothing else (the imports follow).
   */
  async rename(scene: SceneModel, name: string): Promise<boolean> {
    const code = this._context.services.tryGet(CodeServiceToken);
    const project = this._context.services.get(ProjectServiceToken).current.get();
    if (!code || !project || name === scene.className) return false;
    const fileName = scene.path
      .split('/')
      .at(-1)!
      .replace(/\.[cm]?[jt]sx?$/, '');
    const classes = await code
      .analyze<string[]>(scene.path, CLASSES_ANALYZER)
      .catch(() => [] as string[]);
    const to = `${scene.path.split('/').slice(0, -1).join('/')}/${kebab(name)}.ts`;
    const moveFile =
      fileName === kebab(scene.className) && classes.length === 1 && !project.fs.entry(to);
    const documents = this._context.services.tryGet(DocumentServiceToken);
    if (!documents) return false;
    const references = await code.analyze<ReferenceRange[]>(scene.path, REFERENCES_ANALYZER, {
      className: scene.className,
    });
    const importers = moveFile
      ? (
          await code.analyze<string[]>(scene.path, IMPORTERS_ANALYZER).catch(() => [] as string[])
        ).filter((importer) => importer !== scene.path)
      : [];
    const steps: Step[] = [
      async () => {
        const edits: HistoryCommand[] = [];
        for (const { path, ranges } of references) {
          const command = await code.edit(
            path,
            REPLACE_TRANSFORMER,
            { ranges, text: name },
            { label: `Rename ${scene.className}` },
          );
          if (command) edits.push(saved(command, () => documents.save(path)));
        }
        return this._steps.group(`Rename ${scene.className} to ${name}`, edits);
      },
    ];
    if (moveFile) {
      steps.push(
        async () => {
          const edits: HistoryCommand[] = [];
          for (const importer of importers) {
            const command = await code
              .edit(
                importer,
                REWRITE_IMPORTS_TRANSFORMER,
                { from: scene.path, to },
                { label: 'Imports' },
              )
              .catch(() => undefined);
            if (command) edits.push(saved(command, () => documents.save(importer)));
          }
          return this._steps.group('Imports', edits);
        },
        async () => ({
          label: `Rename ${scene.path}`,
          do: async () => project.fs.rename(scene.path, to),
          undo: async () => project.fs.rename(to, scene.path),
        }),
      );
    }
    const ok = await this._steps.push(`Rename ${scene.id} to ${name}`, steps);
    if (ok && this._selected.get().get(this._appId.get() ?? '') === scene.className)
      this.select(name);
    return ok;
  }

  /**
   * Deletes a scene: its entry in `scenes`, the `static parent` of its children (they become
   * roots), and its class (its file, when it holds nothing else).
   */
  async delete(scene: SceneModel): Promise<boolean> {
    const code = this._context.services.tryGet(CodeServiceToken);
    const project = this._context.services.get(ProjectServiceToken).current.get();
    const app = this.app;
    const model = this._model.get();
    if (!code || !project || !app?.entryFile || !model) return false;
    if (model.library?.initial === scene.className)
      return this._steps.fail(
        `Delete ${scene.id}`,
        `${scene.id} is the initial scene: set another one first.`,
      );
    const children = model.scenes.filter((candidate) => candidate.parent === scene.className);
    const classes = await code
      .analyze<string[]>(scene.path, CLASSES_ANALYZER)
      .catch(() => [] as string[]);
    const entry = app.entryFile;
    const steps: Step[] = [
      ...(model.library?.scenes && Object.values(model.library.scenes).includes(scene.className)
        ? [() => this._libraryStep(entry, { kind: 'removeScene', className: scene.className })]
        : []),
      ...children.map(
        (child): Step =>
          () =>
            this._steps.edit(child.path, SCENE_FILE_TRANSFORMER, {
              kind: 'setParent',
              className: child.className,
            } satisfies SceneFileOp),
      ),
      classes.length === 1
        ? async () => {
            let trash = '';
            return {
              label: `Delete ${scene.path}`,
              do: async () => {
                trash = (await project.fs.delete(scene.path)).trashPath;
              },
              undo: async () => project.fs.restore(trash, scene.path),
            };
          }
        : () =>
            this._steps.edit(scene.path, SCENE_FILE_TRANSFORMER, {
              kind: 'removeClass',
              className: scene.className,
            } satisfies SceneFileOp),
    ];
    const ok = await this._steps.push(`Delete ${scene.id}`, steps);
    if (ok) {
      if (this._selected.get().get(app.id) === scene.className) this.select(undefined);
      this._context.services
        .tryGet(NotificationServiceToken)
        ?.notify('info', `Deleted ${scene.id}`, {
          detail: children.length
            ? `${children.map((child) => child.id).join(', ')} no longer ${children.length > 1 ? 'have' : 'has'} a parent. Code that still uses ${scene.className} must be changed.`
            : `Code that still uses ${scene.className} must be changed.`,
          actions: [{ title: 'Undo', run: () => void this._steps.history()?.stack.undo() }],
        });
    }
    return ok;
  }

  /**
   * Declares a var in `SceneVars` (`scene-vars.ts` next to the entry file, created on the first
   * var).
   */
  async addVar(name: string, type: string, description?: string, fallback?: string) {
    const app = this.app;
    const project = this._context.services.get(ProjectServiceToken).current.get();
    if (!app?.entryFile || !project) return false;
    const op: VarsOp = {
      kind: 'addVar',
      name,
      type,
      ...(description && { description }),
      ...(fallback && { default: fallback }),
    };
    const file = this._vars.get()?.file;
    if (file)
      return this._steps.push(`Add var ${name}`, [
        () => this._steps.edit(file, VARS_TRANSFORMER, op),
      ]);
    const path = `${app.entryFile.split('/').slice(0, -1).join('/')}/${VARS_FILE}`;
    if (project.fs.entry(path))
      return this._steps.fail(`Add var ${name}`, `${path} declares no SceneVars.`);
    const text = varsTemplate(name, type, description, fallback);
    return this._steps.push(`Add var ${name}`, [
      async () => ({
        label: `Create ${path}`,
        do: async () => void (await project.fs.write(path, text, { expectedHash: null })),
        undo: async () => void (await project.fs.delete(path)),
      }),
    ]);
  }

  /** Changes a var's type, default or description, or renames it with its string-key uses. */
  async updateVar(
    name: string,
    changes: { rename?: string; type?: string; description?: string; default?: string },
  ): Promise<boolean> {
    const vars = this._vars.get();
    const file = vars?.file;
    const code = this._context.services.tryGet(CodeServiceToken);
    const documents = this._context.services.tryGet(DocumentServiceToken);
    if (!file || !code || !documents) return false;
    const rename = changes.rename && changes.rename !== name ? changes.rename : undefined;
    const steps: Step[] = [
      () =>
        this._steps.edit(file, VARS_TRANSFORMER, {
          kind: 'updateVar',
          name,
          ...changes,
        } satisfies VarsOp),
    ];
    if (rename) {
      const byPath = new Map<string, { start: number; end: number }[]>();
      for (const use of vars.uses.filter((candidate) => candidate.key === name))
        byPath.set(use.path, [...(byPath.get(use.path) ?? []), { start: use.start, end: use.end }]);
      for (const [path, ranges] of byPath)
        steps.push(() => this._steps.edit(path, REPLACE_TRANSFORMER, { ranges, text: rename }));
    }
    return this._steps.push(rename ? `Rename var ${name} to ${rename}` : `Edit var ${name}`, steps);
  }

  /** Removes a var's declaration (its uses stay: they become undeclared keys). */
  async removeVar(name: string): Promise<boolean> {
    const file = this._vars.get()?.file;
    if (!file) return false;
    return this._steps.push(`Remove var ${name}`, [
      () => this._steps.edit(file, VARS_TRANSFORMER, { kind: 'removeVar', name } satisfies VarsOp),
    ]);
  }

  /** Opens a file in the code editor, at a line. */
  async openInCode(path: string, line?: number): Promise<void> {
    await this._context.executeCommand('codeEditor.open', path, line ? { line } : {});
  }

  dispose(): void {
    clearTimeout(this._timer);
    this._store.dispose();
  }

  /** A change of the entry file's `SceneLibrary`, skipped when the app has none. */
  private async _libraryStep(entry: string, op: LibraryOp) {
    if (!this._model.get()?.library?.hasScenes && op.kind !== 'setInitial') return undefined;
    return this._steps.edit(entry, LIBRARY_TRANSFORMER, op);
  }

  /** An observable of a value computed from the model and the selection. */
  private _derived<T>(compute: () => T): Observable<T> {
    return {
      get: compute,
      subscribe: (run) => {
        let last = JSON.stringify(compute());
        const update = () => {
          const value = compute();
          const json = JSON.stringify(value);
          if (json === last) return;
          last = json;
          run(value);
        };
        const model = this._model.subscribe(update);
        const selected = this._selected.subscribe(update);
        return () => {
          model();
          selected();
        };
      },
    };
  }

  /** The app the ECS widgets edit, when it has scenes; else the first app with scenes. */
  private _pickApp(): void {
    const apps = this.apps;
    const active = this._context.contextKeys.get<string>(ACTIVE_APP_KEY);
    const app =
      apps.find((candidate) => candidate.id === active) ??
      apps.find((candidate) => candidate.id === this._appId.get()) ??
      apps.find((candidate) => candidate.type === 'client') ??
      apps[0];
    if (app?.id === this._appId.get()) return;
    this._appId.set(app?.id);
    this._model.set(undefined);
    this._vars.set(undefined);
    this._refresh(0);
  }

  private _bindProject(): void {
    this._project.clear();
    const services = this._context.services;
    const project = services.get(ProjectServiceToken).current.get();
    const documents = services.tryGet(DocumentServiceToken);
    if (!project || !documents) {
      this._projectModel.set(undefined);
      this._model.set(undefined);
      return;
    }
    this._project.add({
      dispose: project.model.subscribe((model) => {
        this._projectModel.set(model);
        this._pickApp();
        this._refresh(0);
      }),
    });
    this._project.add(
      documents.onDidChange(({ uri }) => {
        if (/\.[cm]?[jt]sx?$/.test(uri)) this._refresh();
      }),
    );
    this._project.add(
      project.fs.onDidChange((changes) => {
        if (changes.some((change) => /\.[cm]?[jt]sx?$/.test(change.path))) this._refresh();
      }),
    );
  }

  /** Analyzes the app's scenes again (debounced). */
  private _refresh(delay = REFRESH_DELAY_MS): void {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => void this._analyze(), delay);
  }

  private async _analyze(): Promise<void> {
    const generation = ++this._generation;
    const app = this.app;
    const code = this._context.services.tryGet(CodeServiceToken);
    if (!app?.entryFile || !code) {
      this._model.set(undefined);
      return;
    }
    try {
      const model = await code.analyze<AppScenesModel>(app.entryFile, SCENES_ANALYZER, {
        root: app.root,
      });
      const vars = await code.analyze<VarsModel>(app.entryFile, VARS_ANALYZER, { root: app.root });
      if (generation !== this._generation) return;
      this._model.set(model);
      this._vars.set(vars);
    } catch (error) {
      if (generation !== this._generation) return;
      if (error instanceof Error && error.message.includes('Unknown analyzer')) {
        this._refresh(300);
        return;
      }
      this._context.logger.warn(`Could not read the scenes of ${app.name}`, error);
      this._model.set({
        scenes: [],
        problems: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
}

export const SceneServiceToken = createToken<SceneService>('scene.service');
