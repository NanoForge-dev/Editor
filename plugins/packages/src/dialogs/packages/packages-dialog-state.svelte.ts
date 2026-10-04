import {
  type InstalledPackage,
  RegistryContract,
  type RegistryItem,
  type RegistrySummary,
  type RpcClient,
} from '@nanoforge-dev/editor-sdk';

import { missing } from '../../model/installed-package';

export const registryApi = (rpc: RpcClient) => rpc.api(RegistryContract);
export type RegistryApi = ReturnType<typeof registryApi>;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const codeOf = (error: unknown) => (error as { code?: string }).code;

/**
 * What the Packages dialog keeps while its tabs come and go: the search, the selected package,
 * the project's packages and the change in progress.
 */
export class PackagesDialogState {
  query = $state('');
  results = $state<RegistrySummary[]>([]);
  total = $state(0);
  searching = $state(false);
  /** Why the registry can't be shown, when it can't. */
  unavailable = $state<string>();
  selected = $state<string>();
  details = $state<RegistryItem>();
  installed = $state<InstalledPackage[]>([]);
  /** Why the project's packages can't be read or changed here (a hosted editor). */
  readOnly = $state<string>();
  /** The package being changed, or `*` for all of them. */
  busy = $state<string>();
  failure = $state<string>();
  readonly absent = $derived(missing(this.installed));
  private _generation = 0;

  constructor(
    private readonly _registry: RegistryApi,
    readonly project: string | undefined,
    private readonly _catalog?: { refresh(): unknown },
  ) {}

  installedOf(name: string): InstalledPackage | undefined {
    return this.installed.find((entry) => entry.name === name);
  }

  async loadInstalled(): Promise<void> {
    if (!this.project) return;
    try {
      this.installed = await this._registry.packages({ project: this.project });
      this.readOnly = undefined;
    } catch (error) {
      if (codeOf(error) === 'FORBIDDEN')
        this.readOnly = 'Packages can only be installed in a local editor.';
      else this.failure = message(error);
    }
  }

  async search(text: string): Promise<void> {
    const mine = ++this._generation;
    this.searching = true;
    try {
      const found = await this._registry.search({ type: 'package', q: text });
      if (mine !== this._generation) return;
      this.results = found.items;
      this.total = found.total;
      this.unavailable = undefined;
      if (!found.items.some((item) => item.name === this.selected))
        this.selected = found.items[0]?.name;
    } catch (error) {
      if (mine !== this._generation) return;
      this.results = [];
      this.total = 0;
      this.unavailable =
        codeOf(error) === 'UNAVAILABLE'
          ? 'The package registry cannot be reached right now. Installed packages keep working.'
          : message(error);
    } finally {
      if (mine === this._generation) this.searching = false;
    }
  }

  /** Reads the details of a package; the returned function drops a late answer. */
  loadDetails(name: string): () => void {
    let stale = false;
    this._registry.details({ name }).then(
      (item) => {
        if (!stale) this.details = item;
      },
      () => undefined,
    );
    return () => {
      stale = true;
    };
  }

  install(name: string) {
    const project = this.project;
    return project && this._change(name, () => this._registry.installPackage({ project, name }));
  }

  uninstall(name: string) {
    const project = this.project;
    return project && this._change(name, () => this._registry.uninstallPackage({ project, name }));
  }

  update(name: string, latest: boolean) {
    const project = this.project;
    return (
      project && this._change(name, () => this._registry.updatePackage({ project, name, latest }))
    );
  }

  restore() {
    const project = this.project;
    return project && this._change('*', () => this._registry.restorePackages({ project }));
  }

  /** Runs a change of the project's packages, then lets the editor see the new items. */
  private async _change(name: string, action: () => Promise<InstalledPackage[]>): Promise<void> {
    this.busy = name;
    this.failure = undefined;
    try {
      this.installed = await action();
      void this._catalog?.refresh();
    } catch (error) {
      this.failure =
        codeOf(error) === 'FORBIDDEN'
          ? 'Packages can only be installed in a local editor.'
          : message(error);
    } finally {
      this.busy = undefined;
    }
  }
}
