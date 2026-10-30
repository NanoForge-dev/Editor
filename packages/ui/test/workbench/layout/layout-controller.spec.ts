import { describe, expect, it } from 'vitest';

import { HistoryService } from '@nanoforge-dev/editor-history';
import { ExtensionRegistry } from '@nanoforge-dev/editor-kernel';

import { LayoutController } from '../../../src/workbench/layout/layout-controller';

const setup = () => {
  const settings = {
    get: () => ({}),
    set: async () => undefined,
    hold: () => () => undefined,
    hasStore: () => false,
    observe: () => ({ get: () => ({}), subscribe: () => () => undefined }),
  };
  return new LayoutController({
    extensions: new ExtensionRegistry(),
    history: new HistoryService(),
    settings: settings as never,
  });
};

describe('LayoutController', () => {
  it('keeps floating windows numbered 1 to n when raised', async () => {
    const controller = setup();
    for (const id of ['a', 'b', 'c'])
      await controller.apply({
        type: 'add',
        ref: { instanceId: id, widgetId: id },
        location: {
          kind: 'float',
          floatId: `float-${id}`,
          index: 0,
          rect: { x: 0, y: 0, width: 300, height: 200 },
        },
      });
    for (let round = 0; round < 50; round++)
      for (const id of ['a', 'b', 'c']) controller.raise(`float-${id}`);
    const floats = controller.current.floats;
    expect(floats.map((float) => float.z).sort()).toEqual([1, 2, 3]);
    expect(floats.find((float) => float.id === 'float-c')!.z).toBe(3);
  });
});
