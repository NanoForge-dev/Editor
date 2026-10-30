import { describe, expect, it } from 'vitest';

import type { FileEntry } from '@nanoforge-dev/editor-protocol';

import { OpfsContentCache } from '../../src/cache/opfs.content-cache';
import { ProjectCaches } from '../../src/cache/project-caches';
import { sha1Hex } from '../../src/cache/sha1';

const encoder = new TextEncoder();
const DAY = 24 * 60 * 60 * 1000;

/** A cache of a fresh user; contents are 1 KiB each, the budget a number of them. */
const setup = (budgetKiB = 100, maxAgeDays = 30) => {
  const user = `test-${Math.random().toString(36).slice(2)}`;
  const store = new OpfsContentCache(user);
  const caches = new ProjectCaches(user, store, {
    budgetBytes: () => budgetKiB * 1024,
    maxAgeDays: () => maxAgeDays,
  });
  return { user, store, caches };
};

const content = async (text: string) => {
  const bytes = encoder.encode(text.padEnd(1024, '.'));
  return { bytes, hash: await sha1Hex(bytes) };
};

/** Saves a project's tree holding these contents, as `ProjectFs` does. */
const tree = async (caches: ProjectCaches, projectId: string, hashes: readonly string[]) =>
  caches.tree(projectId).save(
    hashes.map((hash, index): FileEntry => ({
      path: `f${index}`,
      kind: 'file',
      size: 1024,
      mtime: 0,
      hash,
    })),
  );

describe('ProjectCaches', () => {
  it('reports what each project holds, counting a shared content once in the total', async () => {
    const { caches } = setup();
    const shared = await content('shared');
    const own = await content('own');
    await caches.contents().set(shared.hash, shared.bytes);
    await caches.contents().set(own.hash, own.bytes);
    caches.opened('a').dispose();
    caches.opened('b').dispose();
    await tree(caches, 'a', [shared.hash, own.hash]);
    await tree(caches, 'b', [shared.hash]);
    const usage = await caches.usage();
    expect(Object.fromEntries(usage.projects.map((p) => [p.projectId, p.bytes]))).toEqual({
      a: 2048,
      b: 1024,
    });
    expect(usage.bytes).toBe(2048);
    await caches.clearAll();
  });

  it('drops the contents of a project removed, keeps the ones another project uses', async () => {
    const { caches } = setup();
    const shared = await content('shared');
    const own = await content('own');
    for (const item of [shared, own]) await caches.contents().set(item.hash, item.bytes);
    caches.opened('a').dispose();
    caches.opened('b').dispose();
    await tree(caches, 'a', [shared.hash, own.hash]);
    await tree(caches, 'b', [shared.hash]);
    await caches.clearProject('a');
    expect(await caches.contents().get(own.hash)).toBeUndefined();
    expect(await caches.contents().get(shared.hash)).toEqual(shared.bytes);
    expect((await caches.usage()).projects.map((p) => p.projectId)).toEqual(['b']);
    await caches.clearAll();
  });

  it('keeps to its budget, oldest first, never the contents of an open project', async () => {
    const { caches } = setup(2);
    const items = await Promise.all(['one', 'two', 'three'].map(content));
    for (const item of items) await caches.contents().set(item.hash, item.bytes);
    const lease = caches.opened('open');
    caches.opened('closed').dispose();
    await tree(caches, 'open', [items[0]!.hash]);
    await tree(caches, 'closed', [items[1]!.hash, items[2]!.hash]);
    /** Contents written this minute are kept (another tab may be about to use them): age them. */
    await caches.sweep({ recentToo: true });
    const left = await Promise.all(items.map((item) => caches.contents().get(item.hash)));
    expect(left.map(Boolean)).toEqual([true, false, true]);
    lease.dispose();
    await caches.clearAll();
  });

  it('forgets projects not opened for a while', async () => {
    const { caches } = setup(100, 1);
    const item = await content('old');
    await caches.contents().set(item.hash, item.bytes);
    caches.opened('old').dispose();
    await tree(caches, 'old', [item.hash]);
    const realNow = Date.now;
    Date.now = () => realNow() + 2 * DAY;
    try {
      await caches.sweep({ recentToo: true });
    } finally {
      Date.now = realNow;
    }
    expect((await caches.usage()).projects).toEqual([]);
    expect(await caches.contents().get(item.hash)).toBeUndefined();
    await caches.clearAll();
  });

  it('makes room and writes again when the browser says the quota is exceeded', async () => {
    const { user, caches } = setup(2);
    const old = await content('old');
    await caches.contents().set(old.hash, old.bytes);
    caches.opened('closed').dispose();
    await tree(caches, 'closed', [old.hash]);
    const store = (caches as unknown as { _store: OpfsContentCache })._store;
    const set = store.set.bind(store);
    let refused = false;
    store.set = async (hash, bytes) => {
      if (!refused) {
        refused = true;
        throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
      }
      return set(hash, bytes);
    };
    const fresh = await content('fresh');
    await caches.contents().set(fresh.hash, fresh.bytes);
    expect(refused).toBe(true);
    expect(await caches.contents().get(fresh.hash)).toEqual(fresh.bytes);
    expect(user).toBeTruthy();
    await caches.clearAll();
  });
});
