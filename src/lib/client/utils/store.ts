import { type Writable, writable } from 'svelte/store';

import { browser } from '$app/environment';

export function persistedWritable<T>(key: string, initialValue: T): Writable<T> {
  const store = writable(initialValue);

  if (browser) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        store.set(JSON.parse(raw));
      } catch {
        localStorage.removeItem(key);
      }
    }

    store.subscribe((value) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
  }

  return store;
}
