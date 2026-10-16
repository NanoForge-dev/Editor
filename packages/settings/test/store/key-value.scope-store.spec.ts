import { describe, expect, it } from 'vitest';

import type { KeyValueStore } from '../../src/key-value/key-value-store.type';
import { KeyValueScopeStore } from '../../src/store/key-value.scope-store';

/** A key/value store whose writes take a while (like IndexedDB). */
const slowStore = () => {
  const data = new Map<string, unknown>();
  const store: KeyValueStore = {
    get: async <T>(key: string) => data.get(key) as T | undefined,
    set: async (key: string, value: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      data.set(key, value);
    },
    delete: async (key: string) => {
      data.delete(key);
    },
  };
  return { store, data };
};

describe('KeyValueScopeStore', () => {
  it('keeps both of two writes made at once', async () => {
    const { store, data } = slowStore();
    const scope = new KeyValueScopeStore(store, 'machine');
    await scope.initialize();
    await Promise.all([scope.write({ 'a.one': 1 }), scope.write({ 'b.two': 2 })]);
    expect(scope.values.get()).toEqual({ 'a.one': 1, 'b.two': 2 });
    expect(data.get('machine')).toEqual({ 'a.one': 1, 'b.two': 2 });
  });
});
