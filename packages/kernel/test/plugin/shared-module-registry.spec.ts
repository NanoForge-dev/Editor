import { describe, expect, it } from 'vitest';

import { SHARED_GLOBAL, SharedModuleRegistry } from '../../src/plugin/shared-module-registry';

describe('SharedModuleRegistry', () => {
  it('resolves registered modules and rejects unknown ones', () => {
    const svelte = { mount: () => undefined };
    const registry = new SharedModuleRegistry().register('svelte', svelte);

    expect(registry.require('svelte')).toBe(svelte);
    expect(() => registry.require('svelte/store')).toThrow(/not provided/);
    expect(() => registry.register('svelte', {})).toThrow(/already registered/);
  });

  it('installs a lookup scope on the target and removes it', () => {
    const target: Record<string, unknown> = {};
    const registry = new SharedModuleRegistry().register('svelte', { a: 1 });
    const uninstall = registry.install(target);
    const scope = target[SHARED_GLOBAL] as { require(id: string): unknown };

    expect(scope.require('svelte')).toEqual({ a: 1 });
    expect(() => new SharedModuleRegistry().install(target)).toThrow(/already installed/);
    uninstall();
    expect(target[SHARED_GLOBAL]).toBeUndefined();
  });
});
