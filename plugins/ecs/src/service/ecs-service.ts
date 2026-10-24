import {
  type AppModel,
  type CatalogItem,
  CatalogServiceToken,
  type CatalogState,
  CodeServiceToken,
  type Disposable,
  DisposableStore,
  EditorServices,
  type Logger,
  type Observable,
  ObservableValue,
  type PluginContext,
  type ProjectModel,
  ProjectServiceToken,
  createToken,
  itemFitsApp,
} from '@nanoforge-dev/editor-sdk';
import { NotificationServiceToken } from '@nanoforge-dev/editor-sdk/ui';

import {
  ECS_SOURCES,
  type EcsLocation,
  type EcsSource,
  type InheritedLocation,
} from '../extension/ecs-source.extension-point';
import { FIELD_EDITORS, type FieldEditor } from '../extension/field-editor.extension-point';
import { PARAM_PRESETS, type ParamPreset } from '../extension/param-preset.extension-point';
import { checkLibraries } from '../library/check-libraries';
import { createSharedLibrary } from '../library/create-shared-library';
import { relocateItem } from '../library/relocate-item';
import type { EntryModel, EntryOp, ImportNeed, ScopedEntryOp } from '../model/ecs-model.type';
import {
  BUNDLE_SPAWNS_ANALYZER,
  ENTRY_ANALYZER,
  ENTRY_TRANSFORMER,
  ITEM_DOCS_TRANSFORMER,
} from '../model/ecs.const';
import type { ItemDocsOp } from '../model/item-docs.type';
import { codeServices } from './code-services';
import {
  ACTIVE_APP_KEY,
  type InheritedModel,
  REFRESH_DELAY_MS,
  SHOWN_STORAGE_KEY,
  ecsApps,
  ecsData,
  readShown,
  rootsOf,
  sameLocation,
  values,
} from './ecs-data';

/**
 * The ECS view of the open project: the app being edited, its entry file's model (entities,
 * components, systems), the selected entity, and the operations that edit the code.
 */
export class EcsService implements Disposable {
  private readonly _store = new DisposableStore();
  private readonly _project = new DisposableStore();
  private readonly _app = new ObservableValue<string | undefined>(undefined);
  private readonly _model = new ObservableValue<EntryModel | undefined>(undefined);
  private readonly _selection = new ObservableValue<string | undefined>(undefined);
  private readonly _catalog = new ObservableValue<CatalogState | undefined>(undefined);
  private readonly _openedItem = new ObservableValue<string | undefined>(undefined);
  private readonly _projectModel = new ObservableValue<ProjectModel | undefined>(undefined);
  private readonly _libraryProblems = new ObservableValue<readonly string[]>([]);
  private _libraryTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly _shown = new ObservableValue<Record<string, string[]>>(readShown());
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _generation = 0;
  /** The `ecs.sources` contribution used for the selected app, and its subscriptions. */
  private readonly _sourceStore = new DisposableStore();
  private readonly _source = new ObservableValue<EcsSource | undefined>(undefined);
  private readonly _location = new ObservableValue<EcsLocation | undefined>(undefined);
  private readonly _inheritedLocations = new ObservableValue<readonly InheritedLocation[]>([]);
  private readonly _inherited = new ObservableValue<readonly InheritedModel[]>([]);

  constructor(private readonly _context: PluginContext) {
    this._store.add(this._project);
    this._store.add(this._sourceStore);
    this._store.add({
      dispose: _context.scope.observe(CodeServiceToken).subscribe(() => this._bindProject()),
    });
    this._store.add({
      dispose: _context.contributions(ECS_SOURCES).subscribe(() => this._bindSource()),
    });
  }

  /**
   * What the widgets edit: the selected app's `main`, or what an `ecs.sources` contribution
   * says (a scene). `undefined` while that source has nothing chosen.
   */
  get location(): Observable<EcsLocation | undefined> {
    return this._location.readonly();
  }
  /** The `ecs.sources` contribution used for the selected app, if any. */
  get source(): Observable<EcsSource | undefined> {
    return this._source.readonly();
  }
  /** The read-only models shown with the edited one (a scene's parents), outermost first. */
  get inherited(): Observable<readonly InheritedModel[]> {
    return this._inherited.readonly();
  }
  get logger(): Logger {
    return this._context.logger;
  }
  /** Inspector fields contributed by other plugins (`ecs.fieldEditors`). */
  get fieldEditors(): Observable<FieldEditor[]> {
    return values(this._context.contributions(FIELD_EDITORS));
  }

  /** Presets contributed by other plugins (`ecs.paramPresets`). */
  get paramPresets(): Observable<ParamPreset[]> {
    return values(this._context.contributions(PARAM_PRESETS));
  }

  /** Apps with an entry file and the ECS. */
  get apps(): Observable<AppModel[]> {
    return {
      get: () => ecsApps(this._projectModel.get()),
      subscribe: (run) => this._projectModel.subscribe((model) => run(ecsApps(model))),
    };
  }
  /**
   * Import rules of shared libraries (ADR 0004): a library never imports an app, and libraries
   * don't import each other in a cycle.
   */
  get libraryProblems(): Observable<readonly string[]> {
    return this._libraryProblems.readonly();
  }

  /** Shared libraries of the project (ADR 0004). */
  get libraries(): Observable<AppModel[]> {
    const libs = (model: ProjectModel | undefined) =>
      (model?.apps ?? []).filter((app) => app.type === 'lib');
    return {
      get: () => libs(this._projectModel.get()),
      subscribe: (run) => this._projectModel.subscribe((model) => run(libs(model))),
    };
  }

  get appId(): Observable<string | undefined> {
    return this._app.readonly();
  }
  get app(): AppModel | undefined {
    return ecsApps(this._projectModel.get()).find((app) => app.id === this._app.get());
  }
  get model(): Observable<EntryModel | undefined> {
    return this._model.readonly();
  }
  get selection(): Observable<string | undefined> {
    return this._selection.readonly();
  }
  get catalogState(): Observable<CatalogState | undefined> {
    return this._catalog.readonly();
  }
  /** Items the selected app can use. */
  items(): CatalogItem[] {
    const app = this.app;
    const state = this._catalog.get();
    return app && state ? state.items.filter((item) => itemFitsApp(item, app)) : [];
  }
  item(ref: string | undefined): CatalogItem | undefined {
    return ref ? this._catalog.get()?.items.find((item) => item.ref === ref) : undefined;
  }
  selectApp(id: string): void {
    if (this._app.get() === id) return;
    this._app.set(id);
    this._selection.set(undefined);
    this._context.contextKeys.set(ACTIVE_APP_KEY, id);
    this._bindSource();
    this._refresh(0);
  }
  select(entity: string | undefined): void {
    this._selection.set(entity);
  }
  /**
   * Hidden params and groups the user chose to show, for an item (`param:x`, `group:Debug`).
   * Local to this browser and project, never committed.
   */
  get shown(): Observable<Record<string, string[]>> {
    return this._shown.readonly();
  }
  shownFor(ref: string | undefined): Set<string> {
    return new Set(ref ? (this._shown.get()[this._shownKey(ref)] ?? []) : []);
  }
  setShown(ref: string, id: string, visible: boolean): void {
    const key = this._shownKey(ref);
    const current = new Set(this._shown.get()[key] ?? []);
    if (visible) current.add(id);
    else current.delete(id);
    const next = Object.fromEntries(
      Object.entries({ ...this._shown.get(), [key]: [...current] }).filter(
        ([, ids]) => ids.length > 0,
      ),
    );
    this._shown.set(next);
    try {
      localStorage.setItem(SHOWN_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }
  /** The import a use of an item needs. */
  importOf(item: CatalogItem): ImportNeed {
    return { name: item.meta.export, from: item.meta.source };
  }
  /** Edits the edited location's file; one undo step in its history. Returns false when refused. */
  async apply(op: EntryOp, label: string): Promise<boolean> {
    const location = this._location.get();
    const code = codeServices(this._context).code;
    const documents = codeServices(this._context).documents;
    if (!location || !code || !documents) return false;
    try {
      const scoped: ScopedEntryOp = location.scope ? { ...op, scope: location.scope } : op;
      const command = await code.edit(location.path, ENTRY_TRANSFORMER, scoped, { label });
      if (!command) return true;
      const context = documents.historyContext(location.path);
      if (context) await context.stack.push(command);
      else await command.do();
      if (op.kind === 'renameEntity' && this._selection.get() === op.entity)
        this._selection.set(op.name);
      this._refresh(0);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._context.services
        .tryGet(NotificationServiceToken)
        ?.notify('warning', `${label}: not possible`, { detail: message });
      return false;
    }
  }
  /**
   * Edits an app's entry file, or another location of it (a scene: live mode's "Apply to
   * code"); one undo step there.
   */
  async applyTo(
    app: AppModel,
    op: EntryOp,
    label: string,
    location?: EcsLocation,
  ): Promise<boolean> {
    const { documents } = codeServices(this._context);
    const path = location?.path ?? app.entryFile;
    if (!path || !documents) return false;
    try {
      const command = await this.commandFor(app, op, label, location);
      const context = documents.historyContext(path);
      if (context) await context.stack.push(command);
      else await command.do();
      if (app.id === this._app.get()) this._refresh(0);
      return true;
    } catch (error) {
      this._context.services
        .tryGet(NotificationServiceToken)
        ?.notify('warning', `${label}: not possible`, {
          detail: error instanceof Error ? error.message : String(error),
        });
      return false;
    }
  }

  /** The location of a scene of an app, by its id (from the `ecs.sources` that applies). */
  sceneLocation(app: AppModel, scene: string): EcsLocation | undefined {
    return this._context
      .contributions(ECS_SOURCES)
      .get()
      .map((contribution) => contribution.value)
      .filter((source) => source.appliesTo(app))
      .sort((a, b) => b.priority - a.priority)[0]
      ?.locationOf?.(app, scene);
  }

  /**
   * Which spawn call each call site of a running game is: among those of `main`, or of the
   * function it is in for `enclosing` sites (a scene's `setup`). See live mode.
   */
  async analyzeBundle(
    app: AppModel,
    bundle: string,
    sites: readonly { line: number; column: number; enclosing?: boolean }[],
  ): Promise<number[]> {
    const { code } = codeServices(this._context);
    if (!code || !app.entryFile) return sites.map(() => -1);
    return code.analyze<number[]>(app.entryFile, BUNDLE_SPAWNS_ANALYZER, { bundle, sites });
  }

  /** Writes a component's docs (Component panel); one undo step in that file's history. */
  async editDocs(path: string, op: ItemDocsOp, label: string): Promise<boolean> {
    const { code, documents } = codeServices(this._context);
    if (!code || !documents) return false;
    try {
      const command = await code.edit(path, ITEM_DOCS_TRANSFORMER, op, { label });
      if (!command) return true;
      const context = documents.historyContext(path);
      if (context) await context.stack.push(command);
      else await command.do();
      return true;
    } catch (error) {
      this._context.services
        .tryGet(NotificationServiceToken)
        ?.notify('warning', `${label}: not possible`, {
          detail: error instanceof Error ? error.message : String(error),
        });
      return false;
    }
  }

  /**
   * Moves an app's component or system file into a shared library (ADR 0004): the file's own
   * imports follow it, and every import of it is rewritten. One undo step ("Refactors").
   */
  async moveToLibrary(item: CatalogItem, library: AppModel): Promise<boolean> {
    return relocateItem(this._context, item, library, true);
  }

  /** Copies an item's file (an installed package's, usually) into an app or shared library. */
  async copyTo(item: CatalogItem, target: AppModel): Promise<boolean> {
    return relocateItem(this._context, item, target, false);
  }

  /** Creates a shared library (ADR 0004): one undo step in the Refactors history. */
  createLibrary(folder: string, packageName: string): Promise<boolean> {
    return createSharedLibrary(this._context, folder, packageName);
  }

  /** Components defined in a file (the Component panel's subjects). */
  componentsIn(path: string): CatalogItem[] {
    return (this._catalog.get()?.items ?? []).filter(
      (item) => item.meta.source === path && ecsData(item)?.type === 'component',
    );
  }

  /** Opens a file in the code editor, at a line. */
  async openInCode(path: string, line?: number): Promise<void> {
    await this._context.executeCommand('codeEditor.open', path, line ? { line } : {});
  }
  /** Ref of the item last opened in code: the Component panel shows that one. */
  get openedItem(): Observable<string | undefined> {
    return this._openedItem.readonly();
  }
  /** Opens the source of an item at its declaration. */
  async openItem(item: CatalogItem): Promise<void> {
    this._openedItem.set(item.ref);
    let line: number | undefined;
    try {
      const text = await codeServices(this._context).documents?.getText(item.meta.source);
      const name = item.meta.export.replace(/[^\w]/g, '');
      const declaration = new RegExp(
        `^[ \\t]*export\\s+(?:default\\s+)?(?:abstract\\s+)?(?:async\\s+)?(?:class|function\\*?|const|let|var)\\s+${name}\\b`,
        'm',
      ).exec(text ?? '');
      if (text && declaration) line = text.slice(0, declaration.index).split('\n').length;
    } catch {}
    await this.openInCode(item.meta.source, line);
  }
  dispose(): void {
    clearTimeout(this._timer);
    clearTimeout(this._libraryTimer);
    this._store.dispose();
  }
  /** The entry file model of any app (the codegen target's `load`). */
  async analyzeApp(app: AppModel): Promise<EntryModel | undefined> {
    return app.entryFile ? this.analyzeLocation({ path: app.entryFile }) : undefined;
  }
  /** The model of a location: a file's `main`, or a method of a class in it. */
  async analyzeLocation(location: EcsLocation): Promise<EntryModel | undefined> {
    const { code } = codeServices(this._context);
    const project = this._context.services.get(ProjectServiceToken).current.get();
    if (!code || !project) return undefined;
    const roots = rootsOf(
      project.model.get(),
      project.fs.entries.filter((entry) => entry.kind === 'directory').map((entry) => entry.path),
    );
    return code.analyze<EntryModel>(location.path, ENTRY_ANALYZER, {
      roots,
      ...(location.scope && { scope: location.scope }),
    });
  }
  /**
   * An undoable command applying an op to an app's entry file, or to another location (the
   * codegen target's `apply`).
   */
  async commandFor(app: AppModel, op: EntryOp, label: string, location?: EcsLocation) {
    const { code } = codeServices(this._context);
    const path = location?.path ?? app.entryFile;
    if (!path || !code) throw new Error('No entry file or code service');
    const scoped: ScopedEntryOp = location?.scope ? { ...op, scope: location.scope } : op;
    const command = await code.edit(path, ENTRY_TRANSFORMER, scoped, { label });
    if (!command) throw new Error('Nothing to change');
    return command;
  }
  /**
   * Follows the `ecs.sources` contribution that applies to the selected app: its location and
   * inherited ones. Without one, the app's `main` is edited.
   */
  private _bindSource(): void {
    this._sourceStore.clear();
    const app = this.app;
    const source = app
      ? this._context
          .contributions(ECS_SOURCES)
          .get()
          .map((contribution) => contribution.value)
          .filter((candidate) => candidate.appliesTo(app))
          .sort((a, b) => b.priority - a.priority)[0]
      : undefined;
    this._source.set(source);
    if (!app || !source) {
      this._location.set(app?.entryFile ? { path: app.entryFile } : undefined);
      this._inheritedLocations.set([]);
      return;
    }
    const current = source.current(app);
    const inherited = source.inherited(app);
    this._location.set(current.get());
    this._inheritedLocations.set(inherited.get());
    this._sourceStore.add({
      dispose: current.subscribe((location) => {
        if (sameLocation(location, this._location.get())) return;
        this._location.set(location);
        this._selection.set(undefined);
        this._refresh(0);
      }),
    });
    this._sourceStore.add({
      dispose: inherited.subscribe((locations) => {
        this._inheritedLocations.set(locations);
        this._refresh(0);
      }),
    });
  }

  /** Checks the imports of every shared library file (debounced; after catalog changes). */
  private _checkLibraries(): void {
    clearTimeout(this._libraryTimer);
    this._libraryTimer = setTimeout(
      () =>
        void checkLibraries(this._context).then(
          (problems) => problems && this._libraryProblems.set(problems),
        ),
      500,
    );
  }

  private _shownKey(ref: string): string {
    const project = this._context.services.get(ProjectServiceToken).current.get();
    return `${project?.id ?? ''}|${ref}`;
  }
  private _bindProject(): void {
    this._project.clear();
    this._model.set(undefined);
    this._selection.set(undefined);
    const services = this._context.services;
    const project = services.get(ProjectServiceToken).current.get();
    const { code, documents } = codeServices(this._context);
    const catalog = services.tryGet(CatalogServiceToken);
    if (!project || !code || !documents) {
      this._projectModel.set(undefined);
      return;
    }
    this._project.add({
      dispose: project.model.subscribe((model) => {
        this._projectModel.set(model);
        const apps = ecsApps(model);
        if (!apps.some((app) => app.id === this._app.get())) {
          const preferred =
            apps.find((app) => app.id === this._context.contextKeys.get<string>(ACTIVE_APP_KEY)) ??
            apps.find((app) => app.type === 'client') ??
            apps[0];
          this._app.set(preferred?.id);
          if (preferred) this._context.contextKeys.set(ACTIVE_APP_KEY, preferred.id);
        }
        this._bindSource();
        this._refresh(0);
      }),
    });
    if (catalog)
      this._project.add({
        dispose: catalog.state.subscribe((state) => {
          this._catalog.set(state);
          this._refresh();
          this._checkLibraries();
        }),
      });
    this._project.add(
      documents.onDidChange(({ uri }) => {
        if (uri.endsWith('.ts') || uri.endsWith('.js')) this._refresh();
      }),
    );
    this._project.add(
      project.fs.onDidChange((changes) => {
        if (changes.some((change) => /\.[cm]?[jt]sx?$/.test(change.path))) this._refresh();
      }),
    );
  }
  /** Analyzes the entry file again (debounced). */
  private _refresh(delay = REFRESH_DELAY_MS): void {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => void this._analyze(), delay);
  }
  private async _analyze(): Promise<void> {
    const generation = ++this._generation;
    const location = this._location.get();
    if (!location) {
      this._model.set(undefined);
      this._inherited.set([]);
      return;
    }
    try {
      const model = await this.analyzeLocation(location);
      const inherited: InheritedModel[] = [];
      for (const parent of this._inheritedLocations.get()) {
        const parentModel = await this.analyzeLocation(parent).catch(() => undefined);
        if (parentModel) inherited.push({ location: parent, model: parentModel });
      }
      if (generation !== this._generation) return;
      this._inherited.set(inherited);
      if (!model) {
        this._model.set(undefined);
        return;
      }
      this._model.set(model);
      const selected = this._selection.get();
      if (selected && !model.entities.some((entity) => entity.name === selected))
        this._selection.set(undefined);
    } catch (error) {
      if (generation !== this._generation) return;
      if (error instanceof Error && error.message.includes('Unknown analyzer')) {
        this._refresh(300);
        return;
      }
      this.logger.warn(`Could not read ${location.path}`, error);
      this._model.set({
        path: location.path,
        found: false,
        entities: [],
        codeOnly: [],
        systems: [],
        problems: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
}
export const EcsServiceToken = createToken<EcsService>('ecs.service');

export { EditorServices };
