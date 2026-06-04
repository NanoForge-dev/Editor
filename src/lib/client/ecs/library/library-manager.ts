import { type Unsubscriber, get, writable } from 'svelte/store';

import { resetSubscriptions } from '../utils';
import { LibraryHandle } from './library-handle';
import type { Library } from './library.type';

const _storage = writable<Library[]>([]);
const _subscriptions = writable<Record<string, Unsubscriber | null>>({});

export class LibraryManager {
  static reset() {
    _storage.set([]);
    resetSubscriptions(_subscriptions);
  }

  constructor(libraries: Library[]) {
    _storage.set(libraries);
  }

  get store() {
    return _storage;
  }

  get data() {
    return get(_storage);
  }

  add(library: { name: string }): string {
    const libraries = get(_storage);
    libraries.push({ ...library, id: library.name });
    _storage.set(libraries);
    return library.name;
  }

  get(id: string): LibraryHandle {
    const library = get(_storage).find((library) => library.id === id);
    if (!library) throw new Error(`Library with id ${id} not found`);
    const handle = new LibraryHandle(this, library);

    this._subscribe(id, handle);

    return handle;
  }

  delete(id: string) {
    const libraries = get(_storage);
    _storage.set(libraries.filter((library) => library.id !== id));

    const subscriptions = get(_subscriptions);
    if (subscriptions[id]) {
      subscriptions[id]();
      subscriptions[id] = null;
      _subscriptions.set(subscriptions);
    }
  }

  private _subscribe(id: string, handle: LibraryHandle) {
    setTimeout(() => {
      const subscriptions = get(_subscriptions);
      if (subscriptions[id]) return;
      subscriptions[id] = handle.store.subscribe((library) => this._update(id, library));
      _subscriptions.set(subscriptions);
    }, 0);
  }

  private _update(id: string, library: Library) {
    const libraries = get(_storage);
    const index = libraries.findIndex((s) => s.id === id);
    if (index === -1) return;
    libraries[index] = library;
    _storage.set(libraries);
  }
}
