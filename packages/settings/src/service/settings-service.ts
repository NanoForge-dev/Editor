import {
  type Disposable,
  DisposableStore,
  Emitter,
  type Event,
  type Logger,
  type Observable,
  createToken,
  toDisposable,
} from '@nanoforge-dev/editor-kernel';

import type { SettingDefinition } from '../definition/setting-definition.type';
import { combine, deepEqual } from '../merge/deep-merge';
import type { SettingsRegistry } from '../registry/settings-registry';
import { SETTING_SCOPES, type SettingScope, type WritableScope } from '../scope/setting-scope.enum';
import type { ScopeStore, SettingValues } from '../store/scope-store.type';
import type { ImportPreview, SettingInspection, SettingsChange } from './settings-service.type';
import { SettingsError } from './settings.exception';

type KeyOrDefinition<T> = string | SettingDefinition<T>;

/**
 * Resolves settings across scopes (default < account < machine < project < projectLocal),
 * validates writes and notifies changes per key.
 */
export class SettingsService implements Disposable {
  private readonly _stores = new Map<WritableScope, ScopeStore>();
  private readonly _snapshots = new Map<WritableScope, SettingValues>();
  private readonly _onDidChange = new Emitter<SettingsChange>();
  private readonly _observables = new Map<string, Observable<unknown>>();
  private readonly _warned = new Set<string>();
  private readonly _store = new DisposableStore();

  readonly onDidChange: Event<SettingsChange> = this._onDidChange.event;

  constructor(
    readonly registry: SettingsRegistry,
    private readonly _logger?: Logger,
  ) {
    this._store.add(registry.onDidChange((keys) => this._onDidChange.fire({ keys })));
  }

  /** Attaches the store of a scope (e.g. project stores when a project opens). */
  async setStore(scope: WritableScope, store: ScopeStore): Promise<Disposable> {
    if (this._stores.has(scope)) throw new SettingsError(`A ${scope} store is already attached`);
    await store.initialize();
    this._stores.set(scope, store);
    this._snapshots.set(scope, {});
    const subscription = store.values.subscribe((values) => this._storeChanged(scope, values));
    return toDisposable(() => {
      subscription();
      if (this._stores.get(scope) !== store) return;
      this._stores.delete(scope);
      this._storeChanged(scope, {});
      this._snapshots.delete(scope);
    });
  }

  hasStore(scope: WritableScope): boolean {
    return this._stores.has(scope);
  }

  get<T>(key: KeyOrDefinition<T>): T {
    return this.inspect(key).value;
  }

  /** Reactive value of a setting (memoised per key). */
  observe<T>(key: KeyOrDefinition<T>): Observable<T> {
    const name = typeof key === 'string' ? key : key.key;
    let observable = this._observables.get(name);
    if (!observable) {
      observable = {
        get: () => this.get(name),
        subscribe: (run) => {
          let current = this.get(name);
          run(current);
          const subscription = this.onDidChange(({ keys }) => {
            if (!keys.has(name)) return;
            if (!this.registry.get(this.registry.canonicalKey(name))) return;
            const next = this.get(name);
            if (deepEqual(next, current)) return;
            current = next;
            run(next);
          });
          return () => subscription.dispose();
        },
      };
      this._observables.set(name, observable);
    }
    return observable as Observable<T>;
  }

  inspect<T>(key: KeyOrDefinition<T>): SettingInspection<T> {
    const definition = this._definition(key);
    const scopes: Partial<Record<SettingScope, T>> = { default: definition.default };
    const ignored: SettingInspection<T>['ignored'][number][] = [];
    const contributing: T[] = [definition.default];
    let effectiveScope: SettingScope = 'default';

    for (const scope of SETTING_SCOPES) {
      if (scope === 'default') continue;
      const raw = this._raw(scope, definition);
      if (raw === undefined) continue;
      if (!definition.scopes.includes(scope)) {
        ignored.push({ scope, value: raw, reason: 'scope' });
        this._warnOnce(
          `${scope}:${definition.key}:scope`,
          `"${definition.key}" cannot be set at ${scope} level: ignored`,
        );
        continue;
      }
      const parsed = definition.schema.safeParse(raw);
      if (!parsed.success) {
        ignored.push({ scope, value: raw, reason: 'invalid' });
        this._warnOnce(
          `${scope}:${definition.key}:invalid`,
          `Invalid ${scope} value for "${definition.key}": ignored`,
        );
        continue;
      }
      scopes[scope] = parsed.data;
      contributing.push(parsed.data);
      effectiveScope = scope;
    }
    return {
      key: definition.key,
      definition,
      scopes,
      ignored,
      value: combine(definition.mergeStrategy, contributing) as T,
      effectiveScope,
    };
  }

  async set<T>(key: KeyOrDefinition<T>, value: T, scope: WritableScope): Promise<void> {
    const definition = this._definition(key);
    if (!definition.scopes.includes(scope)) {
      throw new SettingsError(`"${definition.key}" cannot be set at ${scope} level`);
    }
    const parsed = definition.schema.safeParse(value);
    if (!parsed.success) {
      throw new SettingsError(
        `Invalid value for "${definition.key}": ${parsed.error.issues[0]?.message ?? 'invalid'}`,
      );
    }
    if (definition.deprecated)
      this._logger?.warn(`"${definition.key}" is deprecated: ${definition.deprecated}`);
    await this._storeOf(scope).write({
      ...this._aliasRemoval(definition),
      [definition.key]: parsed.data,
    });
  }

  /** Removes the value of a scope (falls back to lower scopes). */
  async reset(key: KeyOrDefinition<unknown>, scope: WritableScope): Promise<void> {
    const definition = this._definition(key);
    await this._storeOf(scope).write({
      ...this._aliasRemoval(definition),
      [definition.key]: undefined,
    });
  }

  /** The raw values of a scope as formatted JSON. */
  export(scope: WritableScope): string {
    const values = this._stores.get(scope)?.values.get() ?? {};
    return `${JSON.stringify(values, null, 2)}\n`;
  }

  /** Validates an exported JSON document against the registry before importing it. */
  previewImport(scope: WritableScope, json: string): ImportPreview {
    let document: unknown;
    try {
      document = JSON.parse(json);
    } catch (error) {
      throw new SettingsError(
        `Not a JSON document: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (typeof document !== 'object' || document === null || Array.isArray(document)) {
      throw new SettingsError('Expected a JSON object of settings');
    }
    const current = this._stores.get(scope)?.values.get() ?? {};
    const preview: ImportPreview = {
      scope,
      added: [],
      changed: [],
      unknown: [],
      rejected: [],
      patch: {},
    };
    const patch = preview.patch as Record<string, unknown>;
    for (const [rawKey, value] of Object.entries(document)) {
      const key = this.registry.canonicalKey(rawKey);
      const definition = this.registry.get(key);
      if (!definition) {
        preview.unknown.push(rawKey);
        patch[rawKey] = value;
        continue;
      }
      if (!definition.scopes.includes(scope)) {
        preview.rejected.push({ key, reason: `not allowed at ${scope} level` });
        continue;
      }
      if (!definition.schema.safeParse(value).success) {
        preview.rejected.push({ key, reason: 'invalid value' });
        continue;
      }
      if (!(key in current)) preview.added.push(key);
      else if (!deepEqual(current[key], value)) preview.changed.push(key);
      else continue;
      patch[key] = value;
    }
    return preview;
  }

  async applyImport(preview: ImportPreview): Promise<void> {
    await this._storeOf(preview.scope).write(preview.patch);
  }

  dispose(): void {
    this._store.dispose();
    this._onDidChange.dispose();
  }

  private _definition<T>(key: KeyOrDefinition<T>): SettingDefinition<T> {
    if (typeof key !== 'string') return key;
    const definition = this.registry.get<T>(key);
    if (!definition) throw new SettingsError(`Unknown setting "${key}"`);
    return definition;
  }

  private _storeOf(scope: WritableScope): ScopeStore {
    const store = this._stores.get(scope);
    if (!store) {
      throw new SettingsError(
        scope === 'project' || scope === 'projectLocal'
          ? `Open a project to change ${scope} settings`
          : `No ${scope} settings storage`,
      );
    }
    return store;
  }

  /** Stored value for a setting in a scope, including values under a former key. */
  private _raw(scope: SettingScope, definition: SettingDefinition): unknown {
    if (scope === 'default') return definition.default;
    const values = this._snapshots.get(scope);
    if (!values) return undefined;
    if (values[definition.key] !== undefined) return values[definition.key];
    for (const alias of definition.renamedFrom)
      if (values[alias] !== undefined) return values[alias];
    return undefined;
  }

  private _aliasRemoval(definition: SettingDefinition): Record<string, undefined> {
    return Object.fromEntries(definition.renamedFrom.map((alias) => [alias, undefined]));
  }

  private _storeChanged(scope: WritableScope, values: SettingValues): void {
    const previous = this._snapshots.get(scope) ?? {};
    this._snapshots.set(scope, values);
    const keys = new Set<string>();
    for (const key of new Set([...Object.keys(previous), ...Object.keys(values)])) {
      if (!deepEqual(previous[key], values[key])) keys.add(this.registry.canonicalKey(key));
    }
    if (keys.size) this._onDidChange.fire({ keys });
  }

  private _warnOnce(id: string, message: string): void {
    if (this._warned.has(id)) return;
    this._warned.add(id);
    this._logger?.warn(message);
  }
}

export const SettingsServiceToken = createToken<SettingsService>('settings.service');
