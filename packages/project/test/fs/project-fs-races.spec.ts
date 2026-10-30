import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import type { FileChange, FileEntry } from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';

import type { ContentCache } from '../../src/cache/cache.type';
import { MemoryContentCache } from '../../src/cache/memory.content-cache';
import { MemoryTreeCache } from '../../src/cache/memory.tree-cache';
import { ProjectFs } from '../../src/fs/project-fs';

const encoder = new TextEncoder();
const sha1 = (text: string) => createHash('sha1').update(text).digest('hex');
const fileEntry = (path: string, text: string): FileEntry & { hash: string } => ({
  path,
  kind: 'file',
  size: text.length,
  mtime: 1,
  hash: sha1(text),
});

/** A reply the test sends when it chooses. */
const held = <T>() => {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => (release = resolve));
  return { promise, release };
};

/**
 * A server whose answers the test can hold back: `list`, `readMany` and `stat` take the next
 * queued answer when there is one, else answer from `files`; `write` waits for the next queued
 * release, when there is one.
 */
const fakeServer = (initial: Record<string, string>) => {
  const files = new Map(Object.entries(initial));
  const lists: Promise<FileEntry[]>[] = [];
  const readManys: Promise<unknown>[] = [];
  const stats: Promise<FileEntry | null>[] = [];
  const writes: Promise<unknown>[] = [];
  let onChanges: ((event: { changes: FileChange[] }) => void) | undefined;
  const fs = {
    list: () =>
      lists.shift() ??
      Promise.resolve([...files].map(([path, text]) => fileEntry(path, text) as FileEntry)),
    stat: ({ path }: { path: string }) =>
      stats.shift() ?? Promise.resolve(files.has(path) ? fileEntry(path, files.get(path)!) : null),
    readMany: ({ files: wanted }: { files: { path: string }[] }) =>
      readManys.shift() ??
      Promise.resolve({
        files: wanted.map(({ path }) => ({
          ...fileEntry(path, files.get(path)!),
          content: encoder.encode(files.get(path)!),
        })),
        rest: [],
      }),
    delete: ({ path }: { path: string }) => {
      files.delete(path);
      return Promise.resolve({ trashPath: `.trash/${path}` });
    },
    write: ({ path, content }: { path: string; content: string }) => {
      files.set(path, content);
      return (writes.shift() ?? Promise.resolve()).then(() => fileEntry(path, content));
    },
  };
  const rpc = {
    api: () => fs,
    subscribe: (
      _contract: unknown,
      _name: string,
      _input: unknown,
      listener: (event: { changes: FileChange[] }) => void,
    ) => {
      onChanges = listener;
      return { dispose: () => undefined };
    },
    onDidReconnect: () => ({ dispose: () => undefined }),
  } as unknown as RpcClient;
  return {
    rpc,
    files,
    lists,
    readManys,
    stats,
    writes,
    change: (changes: FileChange[]) => onChanges?.({ changes }),
  };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const open = async (server: ReturnType<typeof fakeServer>, contents: ContentCache) => {
  const fs = new ProjectFs('p', server.rpc, contents, new MemoryTreeCache());
  await fs.initialize();
  return fs;
};

describe('ProjectFs races', () => {
  it('keeps a save made while a listing was on its way', async () => {
    const server = fakeServer({ 'a.ts': 'old' });
    const contents = new MemoryContentCache();
    await contents.set(sha1('old'), encoder.encode('old'));
    const fs = await open(server, contents);
    const listing = held<FileEntry[]>();
    server.lists.push(listing.promise);
    const refreshed = fs.refresh();
    await fs.write('a.ts', 'new');
    listing.release([fileEntry('a.ts', 'old')]);
    await refreshed;
    expect(fs.entry('a.ts')?.hash).toBe(sha1('new'));
    expect((await fs.readText('a.ts')).text).toBe('new');
    fs.dispose();
  });

  it('keeps a change from the server made while a listing was on its way', async () => {
    const server = fakeServer({ 'a.ts': 'old' });
    const contents = new MemoryContentCache();
    await contents.set(sha1('old'), encoder.encode('old'));
    await contents.set(sha1('new'), encoder.encode('new'));
    const fs = await open(server, contents);
    const listing = held<FileEntry[]>();
    server.lists.push(listing.promise);
    const refreshed = fs.refresh();
    server.files.set('a.ts', 'new');
    server.change([{ type: 'changed', path: 'a.ts', kind: 'file' }]);
    await settle();
    listing.release([fileEntry('a.ts', 'old')]);
    await refreshed;
    expect(fs.entry('a.ts')?.hash).toBe(sha1('new'));
    expect((await fs.readText('a.ts')).text).toBe('new');
    fs.dispose();
  });

  it('keeps a change from the server whose stat comes back after a listing', async () => {
    const server = fakeServer({ 'a.ts': 'old' });
    const contents = new MemoryContentCache();
    await contents.set(sha1('new'), encoder.encode('new'));
    const fs = await open(server, contents);
    const listing = held<FileEntry[]>();
    const stat = held<FileEntry | null>();
    server.lists.push(listing.promise);
    server.stats.push(stat.promise);
    const refreshed = fs.refresh();
    server.change([{ type: 'changed', path: 'a.ts', kind: 'file' }]);
    await settle();
    listing.release([fileEntry('a.ts', 'old')]);
    await refreshed;
    stat.release(fileEntry('a.ts', 'new'));
    await settle();
    expect(fs.entry('a.ts')?.hash).toBe(sha1('new'));
    fs.dispose();
  });

  it('keeps a new file a listing shows while the stat of its creation is on its way', async () => {
    const server = fakeServer({ 'a.ts': 'a' });
    const fs = await open(server, new MemoryContentCache());
    const listing = held<FileEntry[]>();
    const stat = held<FileEntry | null>();
    server.lists.push(listing.promise);
    server.stats.push(stat.promise);
    const refreshed = fs.refresh();
    server.files.set('b.ts', 'b');
    server.change([{ type: 'created', path: 'b.ts', kind: 'file' }]);
    await settle();
    listing.release([fileEntry('a.ts', 'a'), fileEntry('b.ts', 'b')]);
    await refreshed;
    expect(fs.entry('b.ts')).toBeDefined();
    stat.release(fileEntry('b.ts', 'b'));
    await settle();
    expect(fs.entry('b.ts')?.hash).toBe(sha1('b'));
    fs.dispose();
  });

  it('reads a file the server changed from the server until its stat comes back', async () => {
    const server = fakeServer({ 'a.ts': 'old' });
    const contents = new MemoryContentCache();
    await contents.set(sha1('old'), encoder.encode('old'));
    const fs = await open(server, contents);
    const changes: FileChange[] = [];
    const subscription = fs.onDidChange((batch) => changes.push(...batch));
    const listing = held<FileEntry[]>();
    const stat = held<FileEntry | null>();
    server.lists.push(listing.promise);
    server.stats.push(stat.promise);
    /** Same size and date: only the hash tells the copies apart. */
    server.files.set('a.ts', 'new');
    const refreshed = fs.refresh();
    server.change([{ type: 'changed', path: 'a.ts', kind: 'file' }]);
    await settle();
    listing.release([fileEntry('a.ts', 'new')]);
    await refreshed;
    expect((await fs.readText('a.ts')).text).toBe('new');
    stat.release(fileEntry('a.ts', 'new'));
    await settle();
    expect(fs.entry('a.ts')?.hash).toBe(sha1('new'));
    expect(changes).toContainEqual({ type: 'changed', path: 'a.ts', kind: 'file' });
    subscription.dispose();
    fs.dispose();
  });

  it('tells a save once, when its own change comes back before the save answers', async () => {
    const server = fakeServer({ 'a.ts': 'old' });
    const fs = await open(server, new MemoryContentCache());
    const changes: FileChange[] = [];
    const subscription = fs.onDidChange((batch) => changes.push(...batch));
    const stat = held<FileEntry | null>();
    server.stats.push(stat.promise);
    const saved = fs.write('a.ts', 'new');
    server.change([{ type: 'changed', path: 'a.ts', kind: 'file' }]);
    await saved;
    stat.release(fileEntry('a.ts', 'new'));
    await settle();
    expect(changes).toEqual([{ type: 'changed', path: 'a.ts', kind: 'file' }]);
    expect(fs.entry('a.ts')?.hash).toBe(sha1('new'));
    subscription.dispose();
    fs.dispose();
  });

  it('tells a save once, when the stat of its own change answers before the save', async () => {
    const server = fakeServer({ 'a.ts': 'old' });
    const fs = await open(server, new MemoryContentCache());
    const changes: FileChange[] = [];
    const subscription = fs.onDidChange((batch) => changes.push(...batch));
    const answer = held<undefined>();
    server.writes.push(answer.promise);
    const saved = fs.write('a.ts', 'new');
    await settle();
    server.change([{ type: 'changed', path: 'a.ts', kind: 'file' }]);
    await settle();
    answer.release(undefined);
    await saved;
    await settle();
    expect(changes).toEqual([{ type: 'changed', path: 'a.ts', kind: 'file' }]);
    expect(fs.entry('a.ts')?.hash).toBe(sha1('new'));
    subscription.dispose();
    fs.dispose();
  });

  it('keeps a file made again when the event of its earlier deletion comes late', async () => {
    const server = fakeServer({ 'a.ts': 'a', 'b.ts': 'b' });
    const fs = await open(server, new MemoryContentCache());
    await fs.delete('b.ts');
    server.files.set('b.ts', 'b');
    const listing = held<FileEntry[]>();
    server.lists.push(listing.promise);
    const refreshed = fs.refresh();
    server.change([{ type: 'deleted', path: 'b.ts', kind: 'file' }]);
    await settle();
    listing.release([fileEntry('a.ts', 'a'), fileEntry('b.ts', 'b')]);
    await refreshed;
    expect(fs.entry('b.ts')).toBeDefined();
    fs.dispose();
  });

  it('keeps a file made again when the event of its earlier deletion comes after a listing', async () => {
    const server = fakeServer({ 'a.ts': 'a', 'b.ts': 'b' });
    const fs = await open(server, new MemoryContentCache());
    await fs.delete('b.ts');
    server.files.set('b.ts', 'b');
    await fs.refresh();
    server.change([{ type: 'deleted', path: 'b.ts', kind: 'file' }]);
    await settle();
    expect(fs.entry('b.ts')).toBeDefined();
    fs.dispose();
  });

  it('does not bring back a file made and deleted at once', async () => {
    const server = fakeServer({ 'a.ts': 'a' });
    const fs = await open(server, new MemoryContentCache());
    const stat = held<FileEntry | null>();
    server.stats.push(stat.promise);
    server.change([{ type: 'created', path: 'tmp.ts', kind: 'file' }]);
    await settle();
    server.change([{ type: 'deleted', path: 'tmp.ts', kind: 'file' }]);
    await settle();
    stat.release(fileEntry('tmp.ts', 'x'));
    await settle();
    expect(fs.entry('tmp.ts')).toBeUndefined();
    fs.dispose();
  });

  it('tells an outside change back to what the editor saved', async () => {
    const server = fakeServer({ 'a.ts': 'old' });
    const fs = await open(server, new MemoryContentCache());
    await fs.write('a.ts', 'mine');
    await settle();
    const changes: FileChange[] = [];
    const subscription = fs.onDidChange((batch) => changes.push(...batch));
    for (const text of ['theirs', 'mine']) {
      server.files.set('a.ts', text);
      server.change([{ type: 'changed', path: 'a.ts', kind: 'file' }]);
      await settle();
    }
    expect(changes).toEqual([
      { type: 'changed', path: 'a.ts', kind: 'file' },
      { type: 'changed', path: 'a.ts', kind: 'file' },
    ]);
    subscription.dispose();
    fs.dispose();
  });

  it('keeps a save made while a read was on its way', async () => {
    const server = fakeServer({ 'a.ts': 'old' });
    const fs = await open(server, new MemoryContentCache());
    const answer = held<unknown>();
    server.readManys.push(answer.promise);
    const read = fs.readText('a.ts');
    /** The read leaves (after its cache lookups) before the save. */
    await settle();
    await fs.write('a.ts', 'new');
    answer.release({
      files: [{ ...fileEntry('a.ts', 'old'), content: encoder.encode('old') }],
      rest: [],
    });
    expect((await read).text).toBe('old');
    expect(fs.entry('a.ts')?.hash).toBe(sha1('new'));
    expect((await fs.readText('a.ts')).text).toBe('new');
    fs.dispose();
  });

  it('keeps the newer of two reads that overlap', async () => {
    const server = fakeServer({ 'a.ts': 'old' });
    const fs = await open(server, new MemoryContentCache());
    const first = held<unknown>();
    server.readManys.push(first.promise);
    const older = fs.readText('a.ts');
    await settle();
    server.files.set('a.ts', 'new');
    expect((await fs.readText('a.ts', { fresh: true })).text).toBe('new');
    first.release({
      files: [{ ...fileEntry('a.ts', 'old'), content: encoder.encode('old') }],
      rest: [],
    });
    await older;
    expect(fs.entry('a.ts')?.hash).toBe(sha1('new'));
    expect((await fs.readText('a.ts')).text).toBe('new');
    fs.dispose();
  });

  it('does not bring back a folder deleted while a listing was on its way', async () => {
    const server = fakeServer({ 'd/a.ts': 'a' });
    const fs = await open(server, new MemoryContentCache());
    const listing = held<FileEntry[]>();
    server.lists.push(listing.promise);
    const refreshed = fs.refresh();
    server.change([{ type: 'deleted', path: 'd', kind: 'directory' }]);
    await settle();
    listing.release([
      { path: 'd', kind: 'directory', size: 0, mtime: 1 },
      fileEntry('d/a.ts', 'a'),
      fileEntry('d/b.ts', 'b'),
    ]);
    await refreshed;
    expect(fs.entries.map((entry) => entry.path)).toEqual([]);
    fs.dispose();
  });

  it('saves without waiting for the content cache', async () => {
    const server = fakeServer({ 'a.ts': 'old' });
    const stuck: ContentCache = {
      get: () => Promise.resolve(undefined),
      set: () => new Promise(() => undefined),
    };
    const fs = await open(server, stuck);
    const saved = await Promise.race([
      fs.write('a.ts', 'new').then(() => 'saved'),
      new Promise((resolve) => setTimeout(() => resolve('waiting'), 200)),
    ]);
    expect(saved).toBe('saved');
    fs.dispose();
  });
});
