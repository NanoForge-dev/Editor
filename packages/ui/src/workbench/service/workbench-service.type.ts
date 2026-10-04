import type {
  ContextKeyService,
  ExtensionRegistry,
  Logger,
  ServiceAccessor,
} from '@nanoforge-dev/editor-kernel';
import type { SettingsService } from '@nanoforge-dev/editor-settings';

import type { StyleService } from '../../style/style-service';
import type { WidgetDescriptor, WidgetView } from '../extension-point/widget.extension-point';
import type { LayoutController } from '../layout/layout-controller';

export type ViewStatus =
  | {
      readonly kind: 'ready';
      readonly view: WidgetView;
      readonly descriptor: WidgetDescriptor;
      /** Plugin that registered the view (its styles go in its cascade layer). */
      readonly owner: string;
    }
  | { readonly kind: 'loading'; readonly descriptor: WidgetDescriptor }
  /** Descriptor known but the plugin registered no view (activation failed…). */
  | { readonly kind: 'unavailable'; readonly descriptor: WidgetDescriptor; readonly reason: string }
  /** Widget of a plugin that is not installed (kept in the layout as a placeholder). */
  | { readonly kind: 'missing'; readonly widgetId: string };

export interface WorkbenchServiceOptions {
  readonly services: ServiceAccessor;
  readonly extensions: ExtensionRegistry;
  readonly styles: StyleService;
  readonly layout: LayoutController;
  readonly contextKeys: ContextKeyService;
  readonly settings: SettingsService;
  /** Activates plugins listening to an activation event (`onWidget:<id>`). */
  readonly activate: (event: string) => Promise<void>;
  readonly logger?: Logger;
}
