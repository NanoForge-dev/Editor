import type { Layout, Location, Rect, WidgetRef } from '../model/layout.type';
import type { SlotId } from '../model/slot-id.enum';

/** Every layout change is one of these serializable operations. */
export type LayoutOp =
  | {
      readonly type: 'add';
      readonly ref: WidgetRef;
      readonly location: Location;
      readonly activate?: boolean;
    }
  | { readonly type: 'remove'; readonly instanceId: string }
  | {
      readonly type: 'move';
      readonly instanceId: string;
      readonly location: Location;
      readonly activate?: boolean;
    }
  | { readonly type: 'activate'; readonly instanceId: string }
  | { readonly type: 'resizeSlot'; readonly slot: SlotId; readonly size: number }
  | {
      readonly type: 'setSplit';
      readonly side: 'left' | 'right' | 'bottom';
      readonly ratio: number;
    }
  | { readonly type: 'toggleSlot'; readonly slot: SlotId; readonly visible: boolean }
  | { readonly type: 'setFloatRect'; readonly floatId: string; readonly rect: Rect }
  | { readonly type: 'focusFloat'; readonly floatId: string; readonly z: number }
  | { readonly type: 'switchScreen'; readonly screen: string | null }
  | { readonly type: 'setScreens'; readonly screens: readonly string[] }
  | { readonly type: 'maximize'; readonly instanceId: string | null }
  | {
      readonly type: 'setScreenOverride';
      readonly screen: string;
      readonly slot: SlotId;
      readonly visible: boolean | null;
    }
  | { readonly type: 'batch'; readonly ops: readonly LayoutOp[] };

export interface Reduction {
  readonly layout: Layout;
  /** Applying it to `layout` gives back the previous layout. */
  readonly inverse: LayoutOp;
}
