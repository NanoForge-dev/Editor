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
import { ecsData } from '../service/ecs-data';
import type { EcsService } from '../service/ecs-service';
import type { EngineWorld, LiveEntity, LiveInstance, LiveSelection, LiveSource } from './live.type';

export const AUTO_APPLY = '@nanoforge/ecs.autoApply';
export const RATE = '@nanoforge/ecs.liveRateMs';

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
  private _generation = 0;

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
   * into `main`, or into the `setup` of the scene that spawned it.
   */
  async applyToCode(appId: string, key: string): Promise<void> {
    const app = this._app(appId);
    const changes = this._pending.get().get(appId)?.get(key);
    if (!app || !changes) return;
    const { scene, name: entityName } = parseKey(key);
    const location: EcsLocation | undefined = scene
      ? this._ecs.sceneLocation(app, scene)
      : undefined;
    if (scene && !location) return;
    const model = location
      ? await this._ecs.analyzeLocation(location)
      : await this._ecs.analyzeApp(app);
    const entity = model?.entities.find((candidate) => candidate.name === entityName);
    if (!entity) return;
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
      await this._ecs.applyTo(app, op, `Apply live ${componentName} of ${entityName}`, location);
    }
    const pending = clonePending(this._pending.get());
    pending.get(appId)?.delete(key);
    this._pending.set(pending);
  }

  /** Applies every change made while playing. */
  async applyAll(): Promise<void> {
    for (const [app, entities] of this._pending.get())
      for (const entity of entities.keys()) await this.applyToCode(app, entity);
  }

  dispose(): void {
    this._store.dispose();
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
    const rate = this._context.services.tryGet(SettingsServiceToken)?.get<number>(RATE) ?? 100;
    this._session.add(runtime.useFeatures({ ecsWorld: { intervalMs: rate } }));
    this._session.add(
      runtime.onEvent((event) => {
        if (event.event !== 'ecs-world') return;
        const world = event.args[0] as EngineWorld;
        void this._linked(event.source, event.app, world).then((instance) => {
          if (generation !== this._generation) return;
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
    const count = [...this._pending.get().values()].reduce(
      (sum, entities) => sum + entities.size,
      0,
    );
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
    const model = app ? await this._ecs.analyzeApp(app).catch(() => undefined) : undefined;
    const spawnsOf = new Map<string, ReturnType<typeof spawnSites>>([['', spawnSites(model)]]);
    if (app) {
      for (const scene of new Set(world.entities.map((entity) => entity.scene))) {
        if (!scene) continue;
        const location = this._ecs.sceneLocation(app, scene);
        const sceneModel = location
          ? await this._ecs.analyzeLocation(location).catch(() => undefined)
          : undefined;
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

export const siteKey = (
  app: string,
  site: { file: string; line: number; column: number },
  scene?: string,
) => `${app}|${scene ?? ''}|${site.file.replace(/\?.*$/, '')}|${site.line}|${site.column}`;

/** The scene and variable of a `LiveEntity.key`. */
export const parseKey = (key: string): { scene?: string; name: string } => {
  const colon = key.indexOf(':');
  return colon < 0 ? { name: key } : { scene: key.slice(0, colon), name: key.slice(colon + 1) };
};

/** The `spawnEntity()` calls of `main` in text order: entity variables and "from code" ones. */
export const spawnSites = (
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

export const clonePending = (pending: Pending): Pending =>
  new Map(
    [...pending].map(([app, entities]) => [
      app,
      new Map([...entities].map(([entity, components]) => [entity, new Map(components)])),
    ]),
  );
