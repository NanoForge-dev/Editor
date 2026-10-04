import { type ExtensionPoint, defineExtensionPoint } from '@nanoforge-dev/editor-kernel';

/** Buttons of the top bar toolbar (play controls…). */
export interface ToolbarItem {
  readonly id: string;
  readonly icon: string;
  readonly title: string;
  readonly command: string;
  readonly args?: readonly unknown[];
  readonly order?: number;
  readonly when?: string;
  /** Highlighted (pressed) while this clause is true. */
  readonly toggled?: string;
}
export const TOOLBAR_ITEMS: ExtensionPoint<ToolbarItem> = defineExtensionPoint('ui.toolbar');
