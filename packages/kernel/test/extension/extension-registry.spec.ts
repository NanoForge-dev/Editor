import { describe, expect, it, vi } from 'vitest';

import { ContributionError } from '../../src/extension/contribution.exception';
import { defineExtensionPoint } from '../../src/extension/define-extension-point';
import { ExtensionRegistry } from '../../src/extension/extension-registry';

interface Mode {
  id: string;
}

describe('ExtensionRegistry', () => {
  it('orders contributions by priority then registration', () => {
    const point = defineExtensionPoint<Mode>('viewport.modes');
    const registry = new ExtensionRegistry();
    registry.contribute(point, { id: 'game' }, { owner: 'viewport' });
    registry.contribute(point, { id: 'scene' }, { owner: 'ecs', priority: 10 });
    registry.contribute(point, { id: 'debug' }, { owner: 'inspectors' });
    expect(registry.getValues(point).map((m) => m.id)).toEqual(['scene', 'game', 'debug']);
  });

  it('keeps only the best contribution of single-valued points', () => {
    const point = defineExtensionPoint<string>('codegen.target', { multiple: false });
    const registry = new ExtensionRegistry();
    registry.contribute(point, 'entry-file', { owner: 'ecs' });
    const scene = registry.contribute(point, 'scene-files', { owner: 'scene', priority: 10 });
    expect(registry.getValues(point)).toEqual(['scene-files']);
    scene.dispose();
    expect(registry.getValues(point)).toEqual(['entry-file']);
  });

  it('validates contributions', () => {
    const point = defineExtensionPoint<number>('numbers', {
      validator: {
        parse: (v) => {
          if (typeof v !== 'number') throw new Error('not a number');
          return v;
        },
      },
    });
    const registry = new ExtensionRegistry();
    expect(() => registry.contribute(point, 'x' as never, { owner: 'bad' })).toThrow(
      ContributionError,
    );
    expect(registry.getValues(point)).toEqual([]);
  });

  it('notifies observers and removes by owner', () => {
    const point = defineExtensionPoint<string>('menus');
    const registry = new ExtensionRegistry();
    const run = vi.fn();
    registry.observe(point).subscribe((list) => run(list.map((c) => c.value)));
    registry.contribute(point, 'a', { owner: 'p1' });
    registry.contribute(point, 'b', { owner: 'p2' });
    registry.removeOwner('p1');
    expect(run.mock.calls).toEqual([[[]], [['a']], [['a', 'b']], [['b']]]);
  });
});
