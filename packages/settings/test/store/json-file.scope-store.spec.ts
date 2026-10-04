import { describe, expect, it } from 'vitest';

import { Emitter } from '@nanoforge-dev/editor-kernel';

import { JsonFileScopeStore, type TextFileAdapter } from '../../src';

describe('JsonFileScopeStore', () => {
  const file = (initial?: string) => {
    let content = initial;
    let version = 0;
    const onDidChange = new Emitter<void>();
    const adapter: TextFileAdapter & {
      external(text: string): void;
      content(): string | undefined;
    } = {
      read: async () =>
        content === undefined ? undefined : { text: content, hash: String(version) },
      write: async (text, expectedHash) => {
        const current = content === undefined ? null : String(version);
        if (current !== expectedHash)
          throw Object.assign(new Error('conflict'), { code: 'CONFLICT' });
        content = text;
        return { hash: String(++version) };
      },
      onDidChange: onDidChange.event,
      external(text) {
        content = text;
        version++;
      },
      content: () => content,
    };
    return adapter;
  };

  it('writes sorted json and retries after external edits', async () => {
    const adapter = file('{"b": 1}');
    const store = new JsonFileScopeStore(adapter);
    await store.initialize();
    adapter.external('{"b": 2, "c": 3}'); // not yet reloaded: the write hits a conflict
    await store.write({ a: true });
    expect(adapter.content()).toBe('{\n  "a": true,\n  "b": 2,\n  "c": 3\n}\n');
  });

  it('reads the file again after a conflict, past a cache that missed the change', async () => {
    const adapter = file('{"b": 1}');
    const read = adapter.read.bind(adapter);
    const store = new JsonFileScopeStore(adapter);
    await store.initialize();
    const stale = await read();
    adapter.read = (fresh) => (fresh ? read() : Promise.resolve(stale));
    adapter.external('{"b": 2}');
    await store.write({ a: true });
    expect(adapter.content()).toBe('{\n  "a": true,\n  "b": 2\n}\n');
  });

  it('never overwrites an invalid file', async () => {
    const store = new JsonFileScopeStore(file('{ oops'));
    await store.initialize();
    expect(store.invalid).toBeDefined();
    await expect(store.write({ a: 1 })).rejects.toThrow(/invalid/);
  });
});
