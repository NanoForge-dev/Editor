import type { Event, Observable, ServiceAccessor } from '@nanoforge-dev/editor-kernel';

import type { WidgetDescriptor } from '../extension-point/widget.extension-point';

/** What a widget receives: its identity, services and lifecycle. */
export interface WidgetInstance {
  readonly instanceId: string;
  readonly descriptor: WidgetDescriptor;
  readonly services: ServiceAccessor;
  /** True while the widget is on screen (its tab active and its slot visible). */
  readonly visible: Observable<boolean>;
  readonly onShow: Event<void>;
  readonly onHide: Event<void>;
  /**
   * Saves a small, JSON-serializable state (scroll, expanded nodes…) kept across reloads of the
   * editor and hot reloads of the plugin.
   */
  setState(state: unknown): void;
  getState<T = unknown>(): T | undefined;
  /** Sets the undo/redo target while the widget has focus. */
  setHistoryContext(contextId: string | undefined): void;
}
