/**
 * Global under which the host exposes its shared modules to editor plugins.
 * Must match `SHARED_GLOBAL` of `@nanoforge-dev/editor-vite-plugin`.
 */
export const SHARED_GLOBAL = '__nanoforge_editor_shared__';

export type ModuleNamespace = Readonly<Record<string, unknown>>;

export interface SharedModuleScope {
  require(id: string): ModuleNamespace;
}

/**
 * Registry of the modules (Svelte runtime, editor SDK…) that plugins share with the host.
 * Plugins built with the editor vite plugin resolve these imports through the installed
 * registry instead of bundling their own copy.
 */
export class SharedModuleRegistry implements SharedModuleScope {
  private readonly _modules = new Map<string, ModuleNamespace>();

  register(id: string, namespace: ModuleNamespace): this {
    if (this._modules.has(id)) throw new Error(`Shared module "${id}" is already registered`);
    this._modules.set(id, namespace);
    return this;
  }

  has(id: string): boolean {
    return this._modules.has(id);
  }

  require(id: string): ModuleNamespace {
    const namespace = this._modules.get(id);
    if (!namespace) {
      throw new Error(`Shared module "${id}" is not provided by this editor version`);
    }
    return namespace;
  }

  get ids(): string[] {
    return [...this._modules.keys()];
  }

  /** Exposes the registry to plugin code. Only one registry can be installed at a time. */
  install(target: object = globalThis): () => void {
    const holder = target as Record<string, unknown>;
    if (holder[SHARED_GLOBAL]) {
      throw new Error('Another shared module registry is already installed');
    }
    const scope: SharedModuleScope = { require: (id) => this.require(id) };
    Object.defineProperty(holder, SHARED_GLOBAL, { value: scope, configurable: true });
    return () => {
      Reflect.deleteProperty(holder, SHARED_GLOBAL);
    };
  }
}
