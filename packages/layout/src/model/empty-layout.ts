import { LAYOUT_VERSION } from './layout.const';
import type { Layout, TabStack } from './layout.type';

const emptyStack: TabStack = { tabs: [], active: null };

export const emptyLayout = (): Layout => ({
  version: LAYOUT_VERSION,
  screens: [],
  activeScreen: null,
  slots: {
    leftTop: { visible: true, size: 260, stack: emptyStack },
    leftBottom: { visible: true, size: 260, stack: emptyStack },
    rightTop: { visible: true, size: 300, stack: emptyStack },
    rightBottom: { visible: true, size: 300, stack: emptyStack },
    bottom: { visible: true, size: 220, stack: emptyStack },
    bottomRight: { visible: true, size: 220, stack: emptyStack },
  },
  split: { left: 0.55, right: 0.55, bottom: 0.5 },
  floats: [],
  maximized: null,
  screenOverrides: {},
});
