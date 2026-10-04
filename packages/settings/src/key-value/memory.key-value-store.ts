import type { KeyValueStore } from './key-value-store.type';

export class MemoryKeyValueStore implements KeyValueStore {
  readonly entries = new Map<string, unknown>();

  get<T>(key: string) {
    return Promise.resolve(structuredClone(this.entries.get(key)) as T | undefined);
  }

  set(key: string, value: unknown) {
    this.entries.set(key, structuredClone(value));
    return Promise.resolve();
  }

  delete(key: string) {
    this.entries.delete(key);
    return Promise.resolve();
  }
}
