import { Emitter, type Event } from '../event/emitter';
import {
  type Disposable,
  DisposableStore,
  isDisposable,
  toDisposable,
} from '../lifecycle/disposable';
import type { Observable } from '../observable/observable';
import type {
  ProvideOptions,
  ServiceAccessor,
  ServiceDecorator,
  ServiceFactory,
} from './container.type';
import { CyclicDependencyError } from './cyclic-dependency.exception';
import { ServiceNotFoundError } from './service-not-found.exception';
import type { ServiceToken } from './service-token';

interface Provider<T> {
  readonly seq: number;
  readonly priority: number;
  readonly factory: ServiceFactory<T> | undefined;
  value: T | undefined;
  created: boolean;
}

interface Override<T> {
  readonly seq: number;
  readonly priority: number;
  readonly decorate: ServiceDecorator<T>;
}

let sequence = 0;
/** Tokens being resolved, across containers (resolution is synchronous). */
const resolving: string[] = [];

const byPriority = (a: { priority: number; seq: number }, b: { priority: number; seq: number }) =>
  a.priority - b.priority || a.seq - b.seq;

/**
 * Hierarchical service container. A child container resolves its own providers first and falls
 * back to its parent; overrides registered anywhere in the chain decorate the resolved service,
 * from the root down to the requesting container.
 */
export class Container implements ServiceAccessor, Disposable {
  private readonly _providers = new Map<string, Provider<unknown>[]>();
  private readonly _overrides = new Map<string, Override<unknown>[]>();
  private readonly _cache = new Map<string, unknown>();
  private readonly _children = new Set<Container>();
  /** Provider and override handles, disposed with the container. */
  private readonly _registrations = new DisposableStore();
  private readonly _onDidChange = new Emitter<ServiceToken<unknown>>();
  private readonly _parentSubscription: Disposable | undefined;
  private _disposed = false;

  /** Fires when the resolution of a token may have changed (here or in an ancestor). */
  readonly onDidChange: Event<ServiceToken<unknown>> = this._onDidChange.event;

  constructor(
    readonly name = 'root',
    private readonly _parent?: Container,
  ) {
    this._parentSubscription = _parent?.onDidChange((token) => this._changed(token));
  }

  get parent(): Container | undefined {
    return this._parent;
  }

  createChild(name: string): Container {
    this._assertAlive();
    const child = new Container(name, this);
    this._children.add(child);
    return child;
  }

  provide<T>(token: ServiceToken<T>, value: T, options: ProvideOptions = {}): Disposable {
    return this._addProvider(token, {
      seq: sequence++,
      priority: options.priority ?? 0,
      factory: undefined,
      value,
      created: false,
    });
  }

  /** Registers a lazy singleton, created on first resolution with this container as accessor. */
  provideFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options: ProvideOptions = {},
  ): Disposable {
    return this._addProvider(token, {
      seq: sequence++,
      priority: options.priority ?? 0,
      factory,
      value: undefined,
      created: false,
    });
  }

  /** Decorates the resolved service; lower priorities wrap first (closest to the base). */
  override<T>(
    token: ServiceToken<T>,
    decorate: ServiceDecorator<T>,
    options: ProvideOptions = {},
  ): Disposable {
    this._assertAlive();
    const entry: Override<unknown> = {
      seq: sequence++,
      priority: options.priority ?? 0,
      decorate: decorate as ServiceDecorator<unknown>,
    };
    const list = this._overrides.get(token.id) ?? [];
    list.push(entry);
    list.sort(byPriority);
    this._overrides.set(token.id, list);
    this._changed(token);
    return this._track(() => {
      const current = this._overrides.get(token.id);
      if (!current) return;
      current.splice(current.indexOf(entry), 1);
      if (!current.length) this._overrides.delete(token.id);
      this._changed(token);
    });
  }

  has(token: ServiceToken<unknown>): boolean {
    return this._findProvider(token.id) !== undefined;
  }

  get<T>(token: ServiceToken<T>): T {
    this._assertAlive();
    if (this._cache.has(token.id)) return this._cache.get(token.id) as T;
    if (resolving.includes(token.id)) throw new CyclicDependencyError([...resolving, token.id]);
    resolving.push(token.id);
    try {
      const found = this._findProvider(token.id);
      if (!found) throw new ServiceNotFoundError(token);
      let value = found.owner._instantiate(found.provider) as T;
      for (const entry of this._collectOverrides(token.id)) {
        value = (entry.decorate as ServiceDecorator<T>)(value, this);
      }
      this._cache.set(token.id, value);
      return value;
    } finally {
      resolving.pop();
    }
  }

  tryGet<T>(token: ServiceToken<T>): T | undefined {
    return this.has(token) ? this.get(token) : undefined;
  }

  /** Every provider's instance for the token, along the chain, lowest priority first. */
  getAll<T>(token: ServiceToken<T>): T[] {
    this._assertAlive();
    const entries: { provider: Provider<unknown>; owner: Container }[] = [];
    for (const container of this._lineage()) {
      for (const provider of container._providers.get(token.id) ?? []) {
        entries.push({ provider, owner: container });
      }
    }
    return entries
      .sort((a, b) => byPriority(a.provider, b.provider))
      .map(({ provider, owner }) => owner._instantiate(provider) as T);
  }

  /** The current resolution of a token, updated when providers or overrides change. */
  observe<T>(token: ServiceToken<T>): Observable<T | undefined> {
    return {
      get: () => this.tryGet(token),
      subscribe: (run) => {
        let current = this.tryGet(token);
        run(current);
        const subscription = this.onDidChange((changed) => {
          if (changed.id !== token.id) return;
          const next = this.tryGet(token);
          if (next === current) return;
          current = next;
          run(next);
        });
        return () => subscription.dispose();
      },
    };
  }

  dispose(): void {
    if (this._disposed) return;
    for (const child of [...this._children]) child.dispose();
    this._disposed = true;
    this._parent?._children.delete(this);
    this._parentSubscription?.dispose();
    this._registrations.dispose();
    this._providers.clear();
    this._overrides.clear();
    this._cache.clear();
    this._onDidChange.dispose();
  }

  private _addProvider<T>(token: ServiceToken<T>, provider: Provider<unknown>): Disposable {
    this._assertAlive();
    const list = this._providers.get(token.id) ?? [];
    list.push(provider);
    list.sort(byPriority);
    this._providers.set(token.id, list);
    this._changed(token);
    return this._track(() => {
      const current = this._providers.get(token.id);
      if (!current || !current.includes(provider)) return;
      current.splice(current.indexOf(provider), 1);
      if (!current.length) this._providers.delete(token.id);
      this._disposeInstance(provider);
      this._changed(token);
    });
  }

  private _findProvider(id: string): { provider: Provider<unknown>; owner: Container } | undefined {
    for (const container of this._lineage()) {
      const providers = container._providers.get(id);
      if (providers?.length) return { provider: providers.at(-1)!, owner: container };
    }
    return undefined;
  }

  private _collectOverrides(id: string): Override<unknown>[] {
    return this._lineage()
      .reverse()
      .flatMap((container) => container._overrides.get(id) ?? []);
  }

  private _track(remove: () => void): Disposable {
    const handle = toDisposable(() => {
      this._registrations.delete(handle);
      remove();
    });
    return this._registrations.add(handle);
  }

  /** This container followed by its ancestors, up to the root. */
  private _lineage(): Container[] {
    const lineage: Container[] = [this];
    for (let parent = this._parent; parent; parent = parent._parent) lineage.push(parent);
    return lineage;
  }

  private _instantiate(provider: Provider<unknown>): unknown {
    if (!provider.factory || provider.created) return provider.value;
    provider.value = provider.factory(this);
    provider.created = true;
    return provider.value;
  }

  private _disposeInstance(provider: Provider<unknown>): void {
    if (provider.factory && provider.created && isDisposable(provider.value)) {
      provider.value.dispose();
    }
    provider.created = false;
    provider.value = undefined;
  }

  private _changed(token: ServiceToken<unknown>): void {
    if (this._disposed) return;
    this._cache.delete(token.id);
    this._onDidChange.fire(token);
  }

  private _assertAlive(): void {
    if (this._disposed) throw new Error(`Container "${this.name}" is disposed`);
  }
}
