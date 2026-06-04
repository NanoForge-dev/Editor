import { type Writable, get, writable } from 'svelte/store';

import { resolveStore } from '../utils';
import type { LibraryManager } from './library-manager';
import type { Library } from './library.type';

const _storage = writable<Record<string, Writable<Library>>>({});

export class LibraryHandle {
  private _manager: LibraryManager;
  public readonly id: string;
  private readonly _store: Writable<Library>;

  static reset() {
    _storage.set({});
  }

  constructor(manager: LibraryManager, library: Library) {
    this._manager = manager;
    this.id = library.id;

    this._store = resolveStore(_storage, this.id, library);
  }

  get store() {
    return this._store;
  }

  get data() {
    return get(this._store);
  }

  update(library: Partial<Library>) {
    this._store.set({ ...get(this._store), ...library });
  }

  delete() {
    this._manager.delete(this.id);
  }
}
