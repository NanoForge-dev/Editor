import {
  type ExtensionPoint,
  type Observable,
  defineExtensionPoint,
} from '@nanoforge-dev/editor-kernel';

export interface StatusBarItem {
  readonly id: string;
  readonly alignment: 'left' | 'right';
  readonly order?: number;
  readonly text: Observable<string>;
  readonly tooltip?: string;
  readonly command?: string;
  readonly when?: string;
}
export const STATUS_BAR_ITEMS: ExtensionPoint<StatusBarItem> = defineExtensionPoint('ui.statusBar');
