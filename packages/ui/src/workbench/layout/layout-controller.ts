import type { HistoryContext } from '@nanoforge-dev/editor-history';
import {
  type Disposable,
  DisposableStore,
  type Observable,
  ObservableValue,
  createToken,
} from '@nanoforge-dev/editor-kernel';
import {
  type Layout,
  LayoutError,
  type LayoutOp,
  type Location,
  type SlotId,
  allWidgets,
  composeDefaultLayout,
  deserializeLayout,
  findWidget,
  isSlotVisible,
  reconcileLayout,
  reduce,
  serializeLayout,
  showSlotOp,
} from '@nanoforge-dev/editor-layout';
import { CoreSettings, type WritableScope } from '@nanoforge-dev/editor-settings';

import { WIDGETS, type WidgetDescriptor } from '../extension-point/widget.extension-point';
import type { LayoutControllerOptions } from './layout-controller.type';

export const LAYOUT_HISTORY_CONTEXT = 'layout';
const SAVE_DELAY_MS = 500;

const mergeKeyOf = (op: LayoutOp): string | undefined => {
  switch (op.type) {
    case 'resizeSlot':
      return `resize:${op.slot}`;
    case 'setSplit':
      return `split:${op.side}`;
    case 'setFloatRect':
      return `float:${op.floatId}`;
    default:
      return undefined;
  }
};

/**
 * Owns the workbench layout: applies operations as undoable steps (history context `layout`),
 * persists the named layouts in settings and adds widgets of newly installed plugins.
 */
export class LayoutController implements Disposable {
  private readonly _layout: ObservableValue<Layout>;
  private readonly _store = new DisposableStore();
  private readonly _history: HistoryContext;
  private _saveTimer: ReturnType<typeof setTimeout> | undefined;
  private _floatCounter = 0;
  private readonly _docksHidden = new ObservableValue(false);

  constructor(private readonly _options: LayoutControllerOptions) {
    this._layout = new ObservableValue(this._load());
    this._history = this._store.add(
      _options.history.registerContext({ id: LAYOUT_HISTORY_CONTEXT, label: 'Layout' }),
    );
    this._store.add(
      _options.extensions.onDidChange((point) => {
        if (point.id !== WIDGETS.id) return;
        const current = this._layout.get();
        const known = new Set([
          ...current.screens,
          ...allWidgets(current).map((ref) => ref.widgetId),
        ]);
        this._layout.set(reconcileLayout(current, this._widgets(), known));
      }),
    );
  }

  get layout(): Observable<Layout> {
    return this._layout.readonly();
  }

  get current(): Layout {
    return this._layout.get();
  }

  /** Docks hidden for a while (e.g. maximize on play): not saved, not an undo step. */
  get docksHidden(): Observable<boolean> {
    return this._docksHidden.readonly();
  }

  setDocksHidden(hidden: boolean): void {
    this._docksHidden.set(hidden);
  }

  /** Applies an operation as one undoable step (continuous resizes merge). */
  async apply(op: LayoutOp, label = 'Change layout'): Promise<void> {
    let inverse: LayoutOp | undefined;
    const mergeKey = mergeKeyOf(op);
    await this._history.stack.push({
      label,
      ...(mergeKey && { mergeKey }),
      do: () => {
        const result = reduce(this._layout.get(), op);
        inverse = result.inverse;
        this._set(result.layout);
      },
      undo: () => {
        if (inverse) this._set(reduce(this._layout.get(), inverse).layout);
      },
      redo: () => {
        const result = reduce(this._layout.get(), op);
        inverse = result.inverse;
        this._set(result.layout);
      },
    });
  }

  /** Shows a tab of its stack, and its slot if hidden (navigation: not an undo step). */
  focusTab(instanceId: string): void {
    this._navigate({ type: 'activate', instanceId });
    const found = findWidget(this._layout.get(), instanceId);
    if (found?.location.kind === 'slot') this.showSlot(found.location.slot, true);
  }

  /** Shows or hides a dock slot on the active screen (navigation: not an undo step). */
  showSlot(slot: SlotId, visible: boolean): void {
    const layout = this._layout.get();
    if (isSlotVisible(layout, slot) !== visible) this._navigate(showSlotOp(layout, slot, visible));
  }

  /** A click on a tool window's icon: shows its panel, or hides the slot if already shown. */
  toggleTool(instanceId: string): void {
    const found = findWidget(this._layout.get(), instanceId);
    if (found?.location.kind !== 'slot') return this.focusTab(instanceId);
    const { slot } = found.location;
    if (found.active && isSlotVisible(this._layout.get(), slot)) this.showSlot(slot, false);
    else this.focusTab(instanceId);
  }

  /** Switches the main screen (navigation: not an undo step). */
  showScreen(screen: string): void {
    this._navigate({ type: 'switchScreen', screen });
  }

  /** Brings a floating window to the front (cosmetic: not an undo step). */
  raise(floatId: string): void {
    const layout = this._layout.get();
    const float = layout.floats.find((candidate) => candidate.id === floatId);
    const top = Math.max(0, ...layout.floats.map((candidate) => candidate.z));
    if (!float || float.z === top) return;
    this._set(reduce(layout, { type: 'focusFloat', floatId, z: top + 1 }).layout);
  }

  /** Opens a widget (or focuses its existing singleton instance). Returns the instance id. */
  async open(widgetId: string, location?: Location): Promise<string> {
    const descriptor = this._descriptor(widgetId);
    const layout = this._layout.get();
    if (descriptor?.kind === 'screen') {
      this.showScreen(widgetId);
      return widgetId;
    }
    const singleton = descriptor?.singleton ?? true;
    const existing = singleton
      ? allWidgets(layout).find((ref) => ref.widgetId === widgetId)
      : undefined;
    if (existing) {
      this.focusTab(existing.instanceId);
      return existing.instanceId;
    }
    const instanceId = singleton ? widgetId : `${widgetId}#${Date.now().toString(36)}`;
    const slot: SlotId = descriptor?.defaultSlot ?? 'leftTop';
    await this.apply(
      {
        type: 'add',
        ref: { instanceId, widgetId },
        location: location ?? { kind: 'slot', slot, index: layout.slots[slot].stack.tabs.length },
      },
      `Open ${descriptor?.title ?? widgetId}`,
    );
    if (!location) this.showSlot(slot, true);
    return instanceId;
  }

  async close(instanceId: string): Promise<void> {
    const found = findWidget(this._layout.get(), instanceId);
    if (!found) return;
    await this.apply(
      { type: 'remove', instanceId },
      `Close ${this._descriptor(found.ref.widgetId)?.title ?? instanceId}`,
    );
  }

  /** Moves a widget into a new floating window at `rect`. */
  async float(
    instanceId: string,
    rect: { x: number; y: number; width: number; height: number },
  ): Promise<void> {
    await this.apply(
      {
        type: 'move',
        instanceId,
        location: { kind: 'float', floatId: this._newFloatId(), index: 0, rect },
      },
      'Float panel',
    );
  }

  /** Stores the current layout under a name and makes it the active one. */
  async saveAs(name: string): Promise<void> {
    await this._persist(name);
    await this._options.settings.set(CoreSettings.layoutActive, name, this._scope());
  }

  /** Switches to a saved layout. */
  async switchTo(name: string): Promise<void> {
    const saved = this._saved()[name];
    const layout = saved === undefined ? undefined : deserializeLayout(saved);
    if (!layout) throw new LayoutError(`No saved layout "${name}"`);
    await this._options.settings.set(CoreSettings.layoutActive, name, this._scope());
    this._set(this._reconcile(layout), { save: false });
    await this._history.stack.clear();
  }

  /** Back to the default layout of the installed widgets. */
  async reset(): Promise<void> {
    this._set(composeDefaultLayout(this._widgets()));
    await this._history.stack.clear();
  }

  get savedNames(): string[] {
    return Object.keys(this._saved()).sort();
  }

  dispose(): void {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      void this._persist(this._activeName());
    }
    this._store.dispose();
  }

  private _navigate(op: LayoutOp): void {
    try {
      this._set(reduce(this._layout.get(), op).layout);
    } catch (error) {
      this._options.logger?.warn('Ignored layout navigation', error);
    }
  }

  private _set(layout: Layout, options: { save?: boolean } = {}): void {
    this._layout.set(layout);
    if (options.save === false) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = undefined;
      this._persist(this._activeName()).catch((error: unknown) =>
        this._options.logger?.error('Saving the layout failed', error),
      );
    }, SAVE_DELAY_MS);
  }

  private async _persist(name: string): Promise<void> {
    const saved = {
      ...this._saved(),
      [name]: JSON.parse(serializeLayout(this._layout.get())) as unknown,
    };
    await this._options.settings.set(CoreSettings.layoutSaved, saved, this._scope());
  }

  private _load(): Layout {
    const saved = this._saved()[this._activeName()];
    const layout = saved === undefined ? undefined : deserializeLayout(saved);
    return layout ? this._reconcile(layout) : composeDefaultLayout(this._widgets());
  }

  private _reconcile(layout: Layout): Layout {
    const known = new Set([...layout.screens, ...allWidgets(layout).map((ref) => ref.widgetId)]);
    return reconcileLayout(layout, this._widgets(), known);
  }

  /** Layouts follow the project when one is open, the user otherwise. */
  private _scope(): WritableScope {
    return this._options.settings.hasStore('projectLocal') ? 'projectLocal' : 'account';
  }

  private _saved(): Record<string, unknown> {
    return this._options.settings.get(CoreSettings.layoutSaved) as Record<string, unknown>;
  }

  private _activeName(): string {
    return this._options.settings.get(CoreSettings.layoutActive);
  }

  private _widgets(): WidgetDescriptor[] {
    return this._options.extensions.getValues(WIDGETS);
  }

  private _descriptor(widgetId: string): WidgetDescriptor | undefined {
    return this._widgets().find((widget) => widget.id === widgetId);
  }

  private _newFloatId(): string {
    const ids = new Set(this._layout.get().floats.map((float) => float.id));
    let id: string;
    do id = `float-${Date.now().toString(36)}-${this._floatCounter++}`;
    while (ids.has(id));
    return id;
  }
}

export const LayoutControllerToken = createToken<LayoutController>('ui.layout');
