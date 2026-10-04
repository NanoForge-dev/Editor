import { type Observable, ObservableValue } from '@nanoforge-dev/editor-kernel';
import type { Location, SlotId } from '@nanoforge-dev/editor-layout';

export type DropTarget =
  | { readonly kind: 'location'; readonly location: Location; readonly rect: DOMRect }
  /** Center of the workbench: the widget becomes a floating window at the pointer. */
  | { readonly kind: 'float'; readonly rect: DOMRect };

export interface DragState {
  readonly instanceId: string;
  readonly title: string;
  readonly x: number;
  readonly y: number;
  readonly target: DropTarget | undefined;
}

const THRESHOLD = 5;

/**
 * Pointer based dragging of dock tabs. Drop zones are elements with `data-nf-drop`:
 * - `tab` (`data-slot`|`data-float`, `data-index`): insert before that tab (or after it, past
 *   its middle: horizontal, or vertical with `data-axis="y"`);
 * - `stack` (`data-slot`|`data-float`, `data-count`): append to the stack;
 * - `center`: float the widget.
 */
export class DragController {
  private readonly _state = new ObservableValue<DragState | undefined>(undefined);

  get state(): Observable<DragState | undefined> {
    return this._state.readonly();
  }

  /** Starts tracking a pointer on a tab; `drop` runs when released over a target. */
  begin(
    event: PointerEvent,
    instanceId: string,
    title: string,
    drop: (target: DropTarget, x: number, y: number) => void,
  ): void {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let started = false;
    const move = (e: PointerEvent) => {
      if (!started && Math.hypot(e.clientX - startX, e.clientY - startY) < THRESHOLD) return;
      started = true;
      this._state.set({
        instanceId,
        title,
        x: e.clientX,
        y: e.clientY,
        target: this._targetAt(e.clientX, e.clientY, instanceId),
      });
    };
    const end = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', cancel);
      const state = this._state.get();
      this._state.set(undefined);
      if (started && state?.target) drop(state.target, e.clientX, e.clientY);
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', cancel);
      this._state.set(undefined);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
  }

  private _targetAt(x: number, y: number, instanceId: string): DropTarget | undefined {
    for (const element of document.elementsFromPoint(x, y)) {
      const zone = (element as HTMLElement).closest<HTMLElement>('[data-nf-drop]');
      if (!zone) continue;
      const rect = zone.getBoundingClientRect();
      const kind = zone.dataset.nfDrop;
      if (kind === 'center') return { kind: 'float', rect };
      const slot = zone.dataset.slot as SlotId | undefined;
      const floatId = zone.dataset.float;
      let index = Number(kind === 'tab' ? zone.dataset.index : zone.dataset.count);
      const after =
        zone.dataset.axis === 'y' ? y > rect.top + rect.height / 2 : x > rect.left + rect.width / 2;
      if (kind === 'tab' && after) index++;
      if (zone.dataset.contains?.split(' ').includes(instanceId)) {
        const current = zone.dataset.contains.split(' ').indexOf(instanceId);
        if (current < index) index--;
      }
      if (slot) return { kind: 'location', location: { kind: 'slot', slot, index }, rect };
      if (floatId) return { kind: 'location', location: { kind: 'float', floatId, index }, rect };
    }
    return undefined;
  }
}
