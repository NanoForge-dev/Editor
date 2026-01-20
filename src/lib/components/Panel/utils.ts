import type { LayoutItem, PanelConfig, WidgetConfig } from './types';

export function isWidget(item: LayoutItem): item is WidgetConfig {
  return item.type === 'widget';
}

export function isPanel(item: LayoutItem): item is PanelConfig {
  return item.type === 'panel';
}

export function cloneLayout(layout: LayoutItem): LayoutItem {
  if (isWidget(layout)) {
    return { ...layout };
  }
  return {
    ...layout,
    children: layout.children.map(cloneLayout),
  };
}
