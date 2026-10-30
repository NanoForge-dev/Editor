import { describe, expect, it } from 'vitest';

import { Emitter } from '@nanoforge-dev/editor-kernel';

import {
  type AccountDocument,
  type AccountRemote,
  AccountSyncStore,
  MemoryKeyValueStore,
  SettingsRegistry,
  SettingsService,
} from '../../src';
import { fontSize } from '../fixtures/settings';

/** In-memory editor server holding the account document. */
class FakeRemote implements AccountRemote {
  document: AccountDocument = { revision: null, values: {} };
  online = true;
  puts = 0;
  private readonly reconnect = new Emitter<void>();
  readonly onDidReconnect = this.reconnect.event;

  get = async () => {
    this.check();
    return structuredClone(this.document);
  };

  put = async (baseRevision: string | null, values: Record<string, unknown>) => {
    this.check();
    this.puts++;
    if (baseRevision !== this.document.revision) {
      throw Object.assign(new Error('conflict'), {
        code: 'CONFLICT',
        data: structuredClone(this.document),
      });
    }
    this.document = {
      revision: String(Number(this.document.revision ?? 0) + 1),
      values: structuredClone(values),
    };
    return { revision: this.document.revision! };
  };

  /** Another device saved. */
  remoteEdit(patch: Record<string, unknown>) {
    this.document = {
      revision: String(Number(this.document.revision ?? 0) + 1),
      values: { ...this.document.values, ...patch },
    };
  }

  goOnline() {
    this.online = true;
    this.reconnect.fire();
  }

  private check() {
    if (!this.online) throw Object.assign(new Error('offline'), { code: 'UNAVAILABLE' });
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AccountSyncStore', () => {
  const create = (remote: FakeRemote, kv = new MemoryKeyValueStore()) =>
    new AccountSyncStore(remote, kv, 'account:local', {
      debounceMs: 0,
      retryDelays: [60_000],
      isSynced: (key) => key !== 'local.only',
    });

  it('pulls the account document', async () => {
    const remote = new FakeRemote();
    remote.remoteEdit({ 'editor.fontSize': 16 });
    const store = create(remote);
    await store.initialize();
    expect(store.values.get()).toEqual({ 'editor.fontSize': 16 });
    expect(store.status.get()).toBe('idle');
  });

  it('is pending from the write until its push, debounce included', async () => {
    const remote = new FakeRemote();
    const store = new AccountSyncStore(remote, new MemoryKeyValueStore(), 'account:local', {
      debounceMs: 50,
    });
    await store.initialize();
    expect(store.status.get()).toBe('idle');
    const write = store.write({ 'editor.fontSize': 14 });
    expect(store.status.get()).toBe('pending');
    await write;
    expect(store.status.get()).toBe('pending');
    await new Promise((resolve) => setTimeout(resolve, 80));
    await flush();
    expect(store.status.get()).toBe('idle');
    expect(remote.document.values).toEqual({ 'editor.fontSize': 14 });
    store.dispose();
  });

  it('keeps offline edits (persisted) and flushes them on reconnect', async () => {
    const remote = new FakeRemote();
    const kv = new MemoryKeyValueStore();
    const store = create(remote, kv);
    await store.initialize();
    remote.online = false;
    await store.write({ 'editor.fontSize': 18, 'local.only': true });
    await store.sync();
    expect(store.status.get()).toBe('offline');
    expect(store.values.get()).toEqual({ 'editor.fontSize': 18, 'local.only': true });
    store.dispose();

    const reloaded = create(remote, kv);
    await reloaded.initialize();
    expect(reloaded.dirty).toBe(true);
    remote.goOnline();
    await flush();
    await reloaded.sync();
    /** Local.only never leaves. */
    expect(remote.document.values).toEqual({ 'editor.fontSize': 18 });
    expect(reloaded.dirty).toBe(false);
    expect(reloaded.status.get()).toBe('idle');
    reloaded.dispose();
  });

  it('merges concurrent edits on 409 and reports true conflicts', async () => {
    const remote = new FakeRemote();
    remote.remoteEdit({ a: 1, b: 1, c: 1 });
    const store = create(remote);
    await store.initialize();

    /** Other device. */
    remote.remoteEdit({ b: 2, c: 2 });
    /** This device. */
    await store.write({ a: 3, c: 3 });
    await store.sync();

    expect(remote.document.values).toEqual({ a: 3, b: 2, c: 3 });
    expect(store.values.get()).toEqual({ a: 3, b: 2, c: 3 });
    expect(store.conflicts.get()).toEqual([{ key: 'c', base: 1, local: 3, remote: 2 }]);
    expect(store.status.get()).toBe('conflict');

    await store.resolveConflict('c', 2);
    await store.sync();
    expect(remote.document.values).toEqual({ a: 3, b: 2, c: 2 });
    expect(store.conflicts.get()).toEqual([]);
    store.dispose();
  });

  it('keeps a write made while a pull is in flight', async () => {
    const remote = new FakeRemote();
    const store = create(remote);
    await store.initialize();
    remote.remoteEdit({ b: 2 });
    let release!: () => void;
    const get = remote.get;
    remote.get = async () => {
      const document = await get();
      await new Promise<void>((resolve) => (release = resolve));
      return document;
    };
    const pulling = store.sync();
    await flush();
    await store.write({ a: 1 });
    release();
    await pulling;
    remote.get = get;
    expect(store.values.get()).toEqual({ a: 1, b: 2 });
    await store.sync();
    expect(remote.document.values).toEqual({ a: 1, b: 2 });
    store.dispose();
  });

  it('merges a 409 with what was written while the push was in flight', async () => {
    const remote = new FakeRemote();
    const store = create(remote);
    await store.initialize();
    remote.remoteEdit({ b: 2 });
    const put = remote.put;
    remote.put = async (base, values) => {
      await store.write({ c: 3 });
      return put(base, values);
    };
    await store.write({ a: 1 });
    await store.sync();
    remote.put = put;
    await store.sync();
    expect(remote.document.values).toEqual({ a: 1, b: 2, c: 3 });
    store.dispose();
  });

  it('works as the account scope of the settings service', async () => {
    const remote = new FakeRemote();
    const registry = new SettingsRegistry();
    registry.register(fontSize);
    const service = new SettingsService(registry);
    const store = create(remote);
    await service.setStore('account', store);
    await service.set(fontSize, 20, 'account');
    await store.sync();
    expect(remote.document.values).toEqual({ 'editor.fontSize': 20 });
    remote.remoteEdit({ 'editor.fontSize': 11 });
    await store.sync();
    expect(service.get(fontSize)).toBe(11);
    store.dispose();
  });
});

describe('AccountSyncStore limits', () => {
  it('says the document is too large instead of sending it, and recovers', async () => {
    const remote = new FakeRemote();
    const store = new AccountSyncStore(remote, new MemoryKeyValueStore(), 'account', {
      debounceMs: 0,
    });
    await store.initialize();
    await store.write({ 'keymap.overrides': 'x'.repeat(300 * 1024) });
    await store.sync();
    expect(store.status.get()).toBe('error');
    expect(store.error.get()).toMatch(/too large to sync/);
    expect(remote.puts).toBe(0);

    await store.write({ 'keymap.overrides': undefined });
    await store.sync();
    expect(store.status.get()).toBe('idle');
    expect(store.error.get()).toBeUndefined();
    store.dispose();
  });
});
