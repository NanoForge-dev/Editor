import { describe, expect, it, vi } from 'vitest';

import { SHARED_GLOBAL as KERNEL_GLOBAL } from '@nanoforge-dev/editor-kernel';
import { MAIN_SHARED_MODULES, SHARED_GLOBAL } from '@nanoforge-dev/editor-vite-plugin';

import { SHARED_MODULE_NAMESPACES } from '../../src/lib/plugin/shared-modules';

vi.mock('@nanoforge-dev/editor-sdk/ui', () => ({}));

describe('shared modules', () => {
  it('provides exactly the modules plugins are built against', () => {
    expect(Object.keys(SHARED_MODULE_NAMESPACES).sort()).toEqual([...MAIN_SHARED_MODULES].sort());
  });

  it('uses the global name the plugin build rewrites to', () => {
    expect(KERNEL_GLOBAL).toBe(SHARED_GLOBAL);
  });
});
