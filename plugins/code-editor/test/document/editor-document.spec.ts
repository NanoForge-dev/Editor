import { describe, expect, it, vi } from 'vitest';

import { EditorDocument } from '../../src/document/editor-document';
import type { DocumentHost } from '../../src/document/editor-document.type';

vi.mock('../../src/monaco/monaco', () => ({ uriOf: (path: string) => path }));

/** Just what a document reads of a Monaco model: its text and version. */
const fakeModel = (initial: string) => {
  let text = initial;
  let version = 1;
  const listeners = new Set<(event: { changes: [] }) => void>();
  return {
    getValue: () => text,
    getAlternativeVersionId: () => version,
    onDidChangeContent: (listener: (event: { changes: [] }) => void) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    dispose: () => undefined,
    type(more: string) {
      text += more;
      version++;
      for (const listener of listeners) listener({ changes: [] });
    },
  };
};

/** A file on a server that refuses a write based on another hash than the file's. */
const setup = async () => {
  const disk = { text: 'a', hash: 'h0', writes: 0 };
  const model = fakeModel(disk.text);
  let release: () => void = () => undefined;
  let started: () => void = () => undefined;
  const writing = new Promise<void>((resolve) => (started = resolve));
  const host = {
    monaco: { editor: { getModel: () => model } },
    unsaved: {
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => undefined,
    },
    beforeSave: async () => undefined,
    backend: {
      read: async () => ({ text: disk.text, hash: disk.hash }),
      write: async (_path: string, text: string, base: string | null) => {
        /** The first write waits, so a second save comes while it runs. */
        if (disk.writes++ === 0)
          await new Promise<void>((resolve) => {
            release = resolve;
            started();
          });
        if (base !== disk.hash)
          throw Object.assign(new Error('changed on disk'), { code: 'CONFLICT' });
        disk.text = text;
        disk.hash = `h${disk.writes}`;
        return { hash: disk.hash };
      },
    },
  } as unknown as DocumentHost;
  const document = await EditorDocument.open(host, 'src/main.ts');
  /** Lets the first write finish, once it is waiting. */
  const finishFirst = async () => {
    await writing;
    release();
  };
  return { document, model, disk, finishFirst };
};

describe('EditorDocument', () => {
  it('runs saves one at a time, each from the hash the last one wrote', async () => {
    const { document, model, disk, finishFirst } = await setup();
    model.type('b');
    const first = document.save();
    model.type('c');
    const second = document.save();
    await finishFirst();
    await expect(Promise.all([first, second])).resolves.toBeDefined();
    expect(disk.text).toBe('abc');
    expect(document.conflict.get()).toBeUndefined();
    expect(document.dirty.get()).toBe(false);
  });

  it('skips a save queued behind another when nothing changed since', async () => {
    const { document, model, disk, finishFirst } = await setup();
    model.type('b');
    const first = document.save();
    const second = document.save();
    await finishFirst();
    await Promise.all([first, second]);
    expect(disk.writes).toBe(1);
  });
});
