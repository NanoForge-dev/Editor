import { describe, expect, it, vi } from 'vitest';

import type { MetaFile } from '@nanoforge-dev/editor-meta/pure';
import type { ClientProject } from '@nanoforge-dev/editor-project';

import { MetaCache } from '../../src/catalog/meta-cache';

const PATH = '.nanoforge/editor/cache/meta/apps/client.json';

describe('MetaCache', () => {
  it('still writes a cache file when its .gitignore cannot be read', async () => {
    const write = vi.fn(async () => undefined);
    const fs = {
      entry: () => ({ kind: 'file' }),
      readText: () => Promise.reject(new Error('project closed')),
      write,
    } as unknown as ClientProject['fs'];
    const cache = new MetaCache(fs);
    cache.set(PATH, { files: {} } as unknown as MetaFile);
    await expect(cache.flush()).resolves.toBeUndefined();
    expect(write).toHaveBeenCalledWith(PATH, expect.any(String));
  });
});
