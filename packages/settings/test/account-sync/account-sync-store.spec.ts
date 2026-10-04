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
    expect(remote.document.values).toEqual({ 'editor.fontSize': 18 }); // local.only never leaves
    expect(reloaded.dirty).toBe(false);
    expect(reloaded.status.get()).toBe('idle');
    reloaded.dispose();
  });

  it('merges concurrent edits on 409 and reports true conflicts', async () => {
    const remote = new FakeRemote();
    remote.remoteEdit({ a: 1, b: 1, c: 1 });
    const store = create(remote);
    await store.initialize();

    remote.remoteEdit({ b: 2, c: 2 }); // other device
    await store.write({ a: 3, c: 3 }); // this device
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
