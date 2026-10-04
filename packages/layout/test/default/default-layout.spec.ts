import { describe, expect, it } from 'vitest';

import { allWidgets, reconcileLayout } from '../../src';
import { apply, base, widgets } from '../fixtures/layout';

describe('default layout', () => {
  it('places screens and docks by order', () => {
    const layout = base();
    expect(layout.screens).toEqual(['scene', 'script', 'game']);
    expect(layout.activeScreen).toBe('scene');
    expect(layout.slots.leftTop.stack).toEqual({
      tabs: [
        { instanceId: 'hierarchy', widgetId: 'hierarchy' },
        { instanceId: 'files', widgetId: 'files' },
      ],
      active: 'hierarchy',
    });
    expect(allWidgets(layout).map((ref) => ref.instanceId)).not.toContain('profiler');
  });

  it('reconciles saved layouts with new plugins', () => {
    const saved = apply(base(), { type: 'remove', instanceId: 'console' });
    const reconciled = reconcileLayout(
      saved,
      [
        ...widgets,
        { id: 'network', kind: 'dock', defaultSlot: 'bottom' },
        { id: 'music', kind: 'screen', order: 9 },
      ],
      new Set([
        'scene',
        'script',
        'game',
        'files',
        'hierarchy',
        'inspector',
        'console',
        'profiler',
      ]),
    );
    expect(reconciled.screens).toEqual(['scene', 'script', 'game', 'music']);
    expect(reconciled.slots.bottom.stack.tabs.map((tab) => tab.instanceId)).toEqual(['network']);
  });
});
