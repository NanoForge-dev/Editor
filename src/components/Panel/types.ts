export type WidgetConfig = {
  type: 'widget';
  size?: number;
  id?: string;
};

export type PanelConfig = {
  type: 'panel';
  direction: 'row' | 'col';
  size?: number;
  children: LayoutItem[];
};

export type LayoutItem = WidgetConfig | PanelConfig;
