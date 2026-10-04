import { type LAYOUT_VERSION } from './layout.const';
import type { SlotId } from './slot-id.enum';

export interface WidgetRef {
  /** Unique in the layout (singleton widgets use their widget id). */
  readonly instanceId: string;
  readonly widgetId: string;
}

export interface TabStack {
  readonly tabs: readonly WidgetRef[];
  readonly active: string | null;
}

export interface SlotState {
  readonly visible: boolean;
  /**
   * Width (side slots) or height (bottom slots) in px. A column's two side slots share their
   * width, the two bottom slots their height (`leftTop`, `rightTop` and `bottom` hold it).
   */
  readonly size: number;
  readonly stack: TabStack;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FloatWindow extends Rect {
  readonly id: string;
  readonly z: number;
  readonly stack: TabStack;
}

export interface Layout {
  readonly version: typeof LAYOUT_VERSION;
  /** Main screens in switcher order (screen widget ids). */
  readonly screens: readonly string[];
  readonly activeScreen: string | null;
  readonly slots: Readonly<Record<SlotId, SlotState>>;
  /** Share of the left/right column given to its top slot, of the bottom row to `bottom` (0-1). */
  readonly split: { readonly left: number; readonly right: number; readonly bottom: number };
  readonly floats: readonly FloatWindow[];
  /** Widget instance shown over the whole workspace, if any. */
  readonly maximized: string | null;
  /** Per screen slot visibility, e.g. hide right docks on the code screen. */
  readonly screenOverrides: Readonly<Record<string, Partial<Record<SlotId, boolean>>>>;
}

/** Where a widget is: a dock slot or a floating window, at a tab index. */
export type Location =
  | { readonly kind: 'slot'; readonly slot: SlotId; readonly index: number }
  | {
      readonly kind: 'float';
      readonly floatId: string;
      readonly index: number;
      readonly rect?: Rect;
    };
