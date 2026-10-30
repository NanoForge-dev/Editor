import {
  type AppModel,
  type Disposable,
  DisposableStore,
  type Observable,
  ObservableValue,
  type PluginContext,
  ProjectServiceToken,
  RuntimeServiceToken,
  SettingsServiceToken,
  createToken,
  isPlaying,
  runtimeOutputPath,
} from '@nanoforge-dev/editor-sdk';
import { NotificationServiceToken } from '@nanoforge-dev/editor-sdk/ui';

import type { EcsLocation } from '../extension/ecs-source.extension-point';
import type { EntryModel, EntryOp } from '../model/ecs-model.type';
import { codeServices } from '../service/code-services';
import { ecsData } from '../service/ecs-data';
import type { EcsService } from '../service/ecs-service';
import type { EngineWorld, LiveEntity, LiveInstance, LiveSelection, LiveSource } from './live.type';

const AUTO_APPLY = '@nanoforge/ecs.autoApply';
const RATE = '@nanoforge/ecs.liveRateMs';

/** Changes made while playing, by app, entity key (`liveKey`), component name and field. */
export type Pending = Map<string, Map<string, Map<string, Record<string, unknown>>>>;

export const LiveServiceToken = createToken<LiveService>('ecs.live');

export class LiveService implements Disposable {
  private readonly _store = new DisposableStore();
  private readonly _session = new DisposableStore();
  private readonly _playing = new ObservableValue(false);
  private readonly _instances = new ObservableValue<readonly LiveInstance[]>([]);
  private readonly _selection = new ObservableValue<LiveSelection | undefined>(undefined);
  private readonly _pending = new ObservableValue<Pending>(new Map());
  /** Per app: the bundle text (fetched once per session) and spawn indexes by site. */
  private readonly _bundles = new Map<string, Promise<string | undefined>>();
  private readonly _siteIndex = new Map<string, number>();
  /**
   * Models of the entry files and scenes the live entities come from, by location: analyzed once
   * per play session, again only after their file changes (worlds come every 100 ms).
   */
  private readonly _models = new Map<string, Promise<EntryModel | undefined>>();
  /** Per game, the number of the last world received and of the last one shown. */
  private readonly _received = new Map<LiveSource, number>();
  private readonly _shown = new Map<LiveSource, number>();
  private _generation = 0;
  /** "Apply to code" runs one at a time: two writes to one file at once refuse each other. */
  private _applying: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly _context: PluginContext,
    private readonly _ecs: EcsService,
  ) {
    this._store.add(this._session);
    const runtime = _context.services.tryGet(RuntimeServiceToken);
    if (!runtime) return;
    this._store.add({
      dispose: runtime.session.subscribe((session) => {
        const playing = isPlaying(session.state);
        if (playing === this._playing.get()) return;
        this._playing.set(playing);
        if (playing) this._start();
        else this._stop();
      }),
    });
  }

  get playing(): Observable<boolean> {
    return this._playing.readonly();
  }

  get instances(): Observable<readonly LiveInstance[]> {
    return this._instances.readonly();
  }

  get selection(): Observable<LiveSelection | undefined> {
    return this._selection.readonly();
  }

  get pending(): Observable<Pending> {
    return this._pending.readonly();
  }

  select(selection: LiveSelection | undefined): void {
    this._selection.set(selection);
  }

  instance(source: LiveSource): LiveInstance | undefined {
    return this._instances.get().find((instance) => instance.source === source);
  }

  entity(selection: LiveSelection | undefined): LiveEntity | undefined {
    return selection
      ? this.instance(selection.source)?.entities.find((entity) => entity.id === selection.id)
      : undefined;
  }

  /** Changes a component field in the running game (and remembers it for "Apply to code"). */
  setField(
    source: LiveSource,
    entity: LiveEntity,
    component: string,
    field: string,
    value: unknown,
  ) {
    this._send('ecs-set-component', [entity.id, component, field, value], source);
    const app = this.instance(source)?.app;
    if (!app || !entity.key) return;
    const pending = clonePending(this._pending.get());
    const byEntity = pending.get(app) ?? new Map();
    const byComponent = byEntity.get(entity.key) ?? new Map();
    byComponent.set(component, { ...(byComponent.get(component) ?? {}), [field]: value });
    byEntity.set(entity.key, byComponent);
    pending.set(app, byEntity);
    this._pending.set(pending);
    if (this._context.services.tryGet(SettingsServiceToken)?.get<boolean>(AUTO_APPLY))
      void this.applyToCode(app, entity.key);
  }

  addComponent(
    source: LiveSource,
    entity: LiveEntity,
    className: string,
    args: readonly unknown[],
  ) {
    this._send('ecs-add-component', [entity.id, className, [...args]], source);
  }

  removeComponent(source: LiveSource, entity: LiveEntity, component: string) {
    this._send('ecs-remove-component', [entity.id, component], source);
  }

  spawnEntity(source: LiveSource) {
    this._send('ecs-spawn-entity', [], source);
  }

  removeEntity(source: LiveSource, entity: LiveEntity) {
    this._send('ecs-remove-entity', [entity.id], source);
  }

  setSystemEnabled(source: LiveSource, index: number, enabled: boolean) {
    this._send('ecs-set-system-enabled', [index, enabled], source);
  }

  /** Whether an entity (by `LiveEntity.key`) has changes made while playing not in the code. */
  hasPending(app: string, key: string | undefined): boolean {
    return !!key && !!this._pending.get().get(app)?.get(key)?.size;
  }

  /**
   * Writes an entity's changes made while playing to the code (one undo step per component):
   * into `main`, or into the `setup` of the scene that spawned it. A change stays pending until
   * it is written: when a write fails, when its component is not in the code, or when it
   * changed again meanwhile. Resolves with whether nothing is left pending for the entity.
   */
  applyToCode(appId: string, key: string): Promise<boolean> {
    const run = this._applying.then(() => this._applyToCode(appId, key));
    this._applying = run.catch(() => undefined);
    return run;
  }

  /** Applies every change made while playing. */
  async applyAll(): Promise<void> {
    for (const [app, entities] of this._pending.get())
      for (const entity of entities.keys()) await this.applyToCode(app, entity);
  }

  dispose(): void {
    this._store.dispose();
  }

  private async _applyToCode(appId: string, key: string): Promise<boolean> {
    const app = this._app(appId);
    const changes = this._pending.get().get(appId)?.get(key);
    if (!changes) return true;
    if (!app) return false;
    const { scene, name: entityName } = parseKey(key);
    const location: EcsLocation | undefined = scene
      ? this._ecs.sceneLocation(app, scene)
      : undefined;
    if (scene && !location) return false;
    const model = location
      ? await this._ecs.analyzeLocation(location)
      : await this._ecs.analyzeApp(app);
    const entity = model?.entities.find((candidate) => candidate.name === entityName);
    if (!entity) return false;
    const applied = new Map<string, Record<string, unknown>>();
    for (const [componentName, fields] of changes) {
      const index = entity.components.findIndex((use) => {
        const item = this._ecs.item(use.item);
        const data = ecsData(item);
        return (data?.type === 'component' ? data.name : use.className) === componentName;
      });
      const use = entity.components[index];
      const item = this._ecs.item(use?.item);
      if (index < 0 || !item) continue;
      const args: Record<number, { value: unknown }> = {};
      item.meta.params.forEach((param, position) => {
        if (param.name in fields) args[position] = { value: fields[param.name] };
      });
      if (!Object.keys(args).length) continue;
      const fill = item.meta.params.map((param) =>
        'default' in param && param.default !== undefined
          ? { value: param.default }
          : param.defaultCode
            ? { code: param.defaultCode }
            : { code: 'undefined' },
      );
      const op: EntryOp = { kind: 'setArgs', entity: entityName, index, args, fill };
      const label = `Apply live ${componentName} of ${entityName}`;
      if (await this._ecs.applyTo(app, op, label, location)) applied.set(componentName, fields);
    }
    const pending = withoutApplied(this._pending.get(), appId, key, applied);
    this._pending.set(pending);
    return !pending.get(appId)?.get(key)?.size;
  }

  private _send(event: string, args: readonly unknown[], source: LiveSource): void {
    this._context.services.tryGet(RuntimeServiceToken)?.send(event, args, source);
  }

  private _app(id: string): AppModel | undefined {
    return this._context.services
      .get(ProjectServiceToken)
      .current.get()
      ?.model.get()
      .apps.find((app) => app.id === id);
  }

  private _start(): void {
    const runtime = this._context.services.tryGet(RuntimeServiceToken);
    if (!runtime) return;
    const generation = ++this._generation;
    this._bundles.clear();
    this._siteIndex.clear();
    this._models.clear();
    this._received.clear();
    this._shown.clear();
    const forget = (path: string) => {
      for (const key of this._models.keys())
        if (key.startsWith(`${path}\0`)) this._models.delete(key);
    };
    const { documents } = codeServices(this._context);
    if (documents) this._session.add(documents.onDidChange(({ uri }) => forget(uri)));
    const project = this._context.services.get(ProjectServiceToken).current.get();
    if (project)
      this._session.add(
        project.fs.onDidChange((changes) => {
          for (const change of changes) forget(change.path);
        }),
      );
    const rate = this._context.services.tryGet(SettingsServiceToken)?.get<number>(RATE) ?? 100;
    this._session.add(runtime.useFeatures({ ecsWorld: { intervalMs: rate } }));
    this._session.add(
      runtime.onEvent((event) => {
        if (event.event !== 'ecs-world') return;
        const world = event.args[0] as EngineWorld;
        const number = (this._received.get(event.source) ?? 0) + 1;
        this._received.set(event.source, number);
        void this._linked(event.source, event.app, world).then((instance) => {
          if (generation !== this._generation) return;
          /** A world linked after a newer one (a file changed in between) is out of date. */
          if (number < (this._shown.get(event.source) ?? 0)) return;
          this._shown.set(event.source, number);
          const others = this._instances.get().filter((other) => other.source !== event.source);
          this._instances.set(
            [...others, instance].sort((a, b) => a.source.localeCompare(b.source)),
          );
        });
      }),
    );
  }

  private _stop(): void {
    this._generation++;
    this._session.clear();
    this._instances.set([]);
    this._selection.set(undefined);
    const count = pendingCount(this._pending.get());
    if (!count) return;
    this._context.services
      .tryGet(NotificationServiceToken)
      ?.notify('info', `${count} ${count > 1 ? 'entities' : 'entity'} changed while playing`, {
        detail: 'The game is stopped: apply the changes to the code, or they are lost.',
        timeout: 0,
        actions: [
          { title: 'Apply to code', run: () => void this.applyAll() },
          { title: 'Discard', run: () => this._pending.set(new Map()) },
        ],
      });
  }

  /**
   * Links the live entities of an app to the code: the variables of its entry file's `main`, or
   * of the `setup` of the scene that spawned them; "from code" ones; runtime ones.
   */
  private async _linked(
    source: LiveSource,
    appId: string,
    world: EngineWorld,
  ): Promise<LiveInstance> {
    const app = this._app(appId);
    const model = app?.entryFile ? await this._model({ path: app.entryFile }) : undefined;
    const spawnsOf = new Map<string, ReturnType<typeof spawnSites>>([['', spawnSites(model)]]);
    if (app) {
      for (const scene of new Set(world.entities.map((entity) => entity.scene))) {
        if (!scene) continue;
        const location = this._ecs.sceneLocation(app, scene);
        const sceneModel = location ? await this._model(location) : undefined;
        spawnsOf.set(scene, spawnSites(sceneModel));
      }
    }
    const unknown = world.entities.filter(
      (entity) => entity.site && !this._siteIndex.has(siteKey(appId, entity.site, entity.scene)),
    );
    if (unknown.length && app) {
      const bundle = await this._bundle(app);
      if (bundle) {
        const sites = unknown.map((entity) => ({
          ...entity.site!,
          ...(entity.scene && { enclosing: true }),
        }));
        const indexes = await this._ecs.analyzeBundle(app, bundle, sites);
        unknown.forEach((entity, i) =>
          this._siteIndex.set(siteKey(appId, entity.site!, entity.scene), indexes[i] ?? -1),
        );
      }
    }
    return {
      source,
      app: appId,
      systems: world.systems,
      entities: world.entities.map((entity) => {
        const index = entity.site
          ? (this._siteIndex.get(siteKey(appId, entity.site, entity.scene)) ?? -1)
          : -1;
        const spawn = index >= 0 ? spawnsOf.get(entity.scene ?? '')?.[index] : undefined;
        return {
          id: entity.id,
          components: entity.components,
          runtime: !spawn,
          ...(entity.scene && { scene: entity.scene }),
          ...(spawn?.name && {
            code: spawn.name,
            key: entity.scene ? `${entity.scene}:${spawn.name}` : spawn.name,
          }),
          ...(spawn && !spawn.name && { codeOnlyLine: spawn.line }),
        };
      }),
    };
  }

  private _model(location: EcsLocation): Promise<EntryModel | undefined> {
    const key = `${location.path}\0${JSON.stringify(location.scope ?? null)}`;
    let model = this._models.get(key);
    if (!model) {
      model = this._ecs.analyzeLocation(location).catch(() => undefined);
      this._models.set(key, model);
      /** No model (the code worker starting, an error): asked again with the next world. */
      void model.then((result) => {
        if (!result && this._models.get(key) === model) this._models.delete(key);
      });
    }
    return model;
  }

  private _bundle(app: AppModel): Promise<string | undefined> {
    let bundle = this._bundles.get(app.id);
    if (!bundle) {
      const project = this._context.services.get(ProjectServiceToken).current.get();
      const url = project ? `${runtimeOutputPath(project.id, app.id)}main.js` : undefined;
      bundle = url
        ? fetch(url)
            .then((response) => (response.ok ? response.text() : undefined))
            .catch(() => undefined)
        : Promise.resolve(undefined);
      this._bundles.set(app.id, bundle);
    }
    return bundle;
  }
}

const siteKey = (
  app: string,
  site: { file: string; line: number; column: number },
  scene?: string,
) => `${app}|${scene ?? ''}|${site.file.replace(/\?.*$/, '')}|${site.line}|${site.column}`;

/** The scene and variable of a `LiveEntity.key`. */
const parseKey = (key: string): { scene?: string; name: string } => {
  const colon = key.indexOf(':');
  return colon < 0 ? { name: key } : { scene: key.slice(0, colon), name: key.slice(colon + 1) };
};

/** The `spawnEntity()` calls of `main` in text order: entity variables and "from code" ones. */
const spawnSites = (
  model: EntryModel | undefined,
): { name?: string; line: number; start: number }[] =>
  [
    ...(model?.entities ?? []).map((entity) => ({
      name: entity.name,
      line: entity.line,
      start: entity.node.start,
    })),
    ...(model?.codeOnly ?? []).map((entry) => ({ line: entry.line, start: entry.start })),
  ].sort((a, b) => a.start - b.start);

/**
 * `pending` without the components of an entity that were written to the code, unless they
 * changed again since (`setField` replaces a component's fields object on every change).
 */
export const withoutApplied = (
  pending: Pending,
  app: string,
  key: string,
  applied: ReadonlyMap<string, Record<string, unknown>>,
): Pending => {
  const next = clonePending(pending);
  const components = next.get(app)?.get(key);
  if (!components) return next;
  for (const [component, fields] of applied) {
    if (components.get(component) === fields) components.delete(component);
  }
  if (!components.size) next.get(app)!.delete(key);
  return next;
};

/** How many entities have changes not applied to the code yet. */
export const pendingCount = (pending: Pending): number =>
  [...pending.values()].reduce((sum, entities) => sum + entities.size, 0);

const clonePending = (pending: Pending): Pending =>
  new Map(
    [...pending].map(([app, entities]) => [
      app,
      new Map([...entities].map(([entity, components]) => [entity, new Map(components)])),
    ]),
  );
