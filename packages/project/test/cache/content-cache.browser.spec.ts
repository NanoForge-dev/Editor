import { describe, expect, it } from 'vitest';

import type { ContentCache } from '../../src/cache/cache.type';
import { MemoryContentCache } from '../../src/cache/memory.content-cache';
import { writeOpfsFile } from '../../src/cache/opfs-write';
import { OPFS_LAYOUT, OPFS_ROOT, OpfsContentCache } from '../../src/cache/opfs.content-cache';
import { sha1Hex } from '../../src/cache/sha1';

const encoder = new TextEncoder();
/** `sha1('héllo, 世界\n')` as the server computes it (Node's crypto). */
const SERVER_HASH = '67e9b2991ae39a03bb20684bd75feb048c389564';

const user = () => `test-${Math.random().toString(36).slice(2)}`;

describe.each([
  ['memory', () => new MemoryContentCache()],
  ['OPFS', () => new OpfsContentCache(user())],
] as const)('%s content cache', (_name, create: () => ContentCache) => {
  it('gives back the bytes kept under their hash, nothing for others', async () => {
    const cache = create();
    const bytes = encoder.encode('héllo, 世界\n');
    const hash = await sha1Hex(bytes);
    expect(hash).toBe(SERVER_HASH);
    await cache.set(hash, bytes);
    expect(await cache.get(hash)).toEqual(bytes);
    expect(await cache.get('0'.repeat(40))).toBeUndefined();
  });
});

describe('OPFS content cache', () => {
  it('never gives back bytes that do not match their hash, and drops them', async () => {
    const name = user();
    const cache = new OpfsContentCache(name);
    const hash = await sha1Hex(encoder.encode('right'));
    await writeOpfsFile(
      [OPFS_ROOT, OPFS_LAYOUT, encodeURIComponent(name), 'blobs', hash],
      encoder.encode('wrong'),
    );
    expect(await cache.get(hash)).toBeUndefined();
    await cache.set(hash, encoder.encode('right'));
    expect(new TextDecoder().decode(await cache.get(hash))).toBe('right');
  });

  it('writes through a worker where createWritable is missing', async () => {
    const name = user();
    const cache = new OpfsContentCache(name);
    const bytes = encoder.encode('written by a worker');
    const hash = await sha1Hex(bytes);
    await writeOpfsFile([OPFS_ROOT, OPFS_LAYOUT, encodeURIComponent(name), 'blobs', hash], bytes, {
      viaWorker: true,
    });
    expect(await cache.get(hash)).toEqual(bytes);
  });

  it('clears what one user kept, not another', async () => {
    const [first, second] = [new OpfsContentCache(user()), new OpfsContentCache(user())];
    const bytes = encoder.encode('shared');
    const hash = await sha1Hex(bytes);
    await first.set(hash, bytes);
    await second.set(hash, bytes);
    await first.clear();
    expect(await first.get(hash)).toBeUndefined();
    expect(await second.get(hash)).toEqual(bytes);
  });
});
