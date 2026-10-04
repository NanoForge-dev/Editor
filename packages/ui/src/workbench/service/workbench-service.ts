import { z } from 'zod';

import { HISTORY_CONTEXT_KEY, TEXT_INPUT_FOCUS_KEY } from '@nanoforge-dev/editor-history';
import {
  type Disposable,
  DisposableStore,
  Emitter,
  type Observable,
  ObservableValue,
  createToken,
  derived,
  observe,
  toDisposable,
} from '@nanoforge-dev/editor-kernel';
import {
  type Layout,
  type WidgetRef,
  findWidget,
  isSlotVisible,
} from '@nanoforge-dev/editor-layout';
import { defineSetting } from '@nanoforge-dev/editor-settings';

import {
  WIDGETS,
  WIDGET_VIEWS,
  type WidgetDescriptor,
  type WidgetView,
} from '../extension-point/widget.extension-point';
import type { WidgetInstance } from '../widget/widget-instance.type';
import type { ViewStatus, WorkbenchServiceOptions } from './workbench-service.type';

/** Small per instance states of widgets (scroll, expanded nodes…). */
export const WidgetStateSetting = defineSetting({
  key: 'layout.widgetState',
  schema: z.record(z.string(), z.unknown()),
  default: {},
  title: 'Panel states',
  category: 'Editor/Layout',
  scopes: ['machine', 'projectLocal'],
});

/** Focus context keys. */
export const FOCUSED_WIDGET_KEY = 'focusedWidget';

const isTextInput = (element: Element | null): boolean =>
  !!element &&
  (element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement &&
      !['checkbox', 'radio', 'button', 'range', 'color'].includes(element.type)) ||
    (element as HTMLElement).isContentEditable ||
    !!element.closest('.monaco-editor'));

interface InstanceRecord {
  readonly instance: WidgetInstance;
  historyContext: string | undefined;
  readonly store: DisposableStore;
}

/** Resolves widget views, instances and focus for the layout renderer. */
export class WorkbenchService implements Disposable {
  private readonly _store = new DisposableStore();
  private readonly _activations = new Map<string, Promise<void>>();
  private readonly _failed = new Map<string, string>();
  private readonly _instances = new Map<string, InstanceRecord>();
  private readonly _styleRefs = new Map<WidgetView, { count: number; sheet: Disposable }>();
  private readonly _state: ObservableValue<Record<string, unknown>>;
  private _stateTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly _onDidFail = new Emitter<string>();

  constructor(private readonly _options: WorkbenchServiceOptions) {
    this._store.add(_options.settings.registry.register(WidgetStateSetting));
    this._state = new ObservableValue({
      ...(_options.settings.get(WidgetStateSetting) as Record<string, unknown>),
    });
  }

  descriptor(widgetId: string): WidgetDescriptor | undefined {
    return this._options.extensions.getValues(WIDGETS).find((widget) => widget.id === widgetId);
  }

  get descriptors(): Observable<readonly WidgetDescriptor[]> {
    return derived([this._options.extensions.observe(WIDGETS)], (list) =>
      list.map((contribution) => contribution.value),
    );
  }

  /** How to render a widget; triggers its plugin activation when needed. */
  view(widgetId: string): Observable<ViewStatus> {
    const compute = (): ViewStatus => {
      const descriptor = this.descriptor(widgetId);
      if (!descriptor) return { kind: 'missing', widgetId };
      const contribution = this._options.extensions
        .getContributions(WIDGET_VIEWS)
        .find((candidate) => candidate.value.id === widgetId);
      if (contribution) {
        return { kind: 'ready', view: contribution.value, descriptor, owner: contribution.owner };
      }
      const failure = this._failed.get(widgetId);
      if (failure) return { kind: 'unavailable', descriptor, reason: failure };
      this._activate(widgetId);
      return { kind: 'loading', descriptor };
    };
    return {
      get: compute,
      subscribe: (run) => {
        let current = compute();
        run(current);
        const refresh = () => {
          const next = compute();
          if (
            next.kind === current.kind &&
            (next as { view?: unknown }).view === (current as { view?: unknown }).view
          )
            return;
          current = next;
          run(next);
        };
        const subscription = this._options.extensions.onDidChange(refresh);
        const failures = this._onDidFail.event(refresh);
        return () => {
          subscription.dispose();
          failures.dispose();
        };
      },
    };
  }

  /** The instance object handed to a widget view (created once per instance id). */
  instance(ref: WidgetRef): WidgetInstance {
    const existing = this._instances.get(ref.instanceId);
    if (existing) return existing.instance;
    const store = new DisposableStore();
    const onShow = store.add(new Emitter<void>());
    const onHide = store.add(new Emitter<void>());
    const visible = derived([this._options.layout.layout], (layout) => isVisible(layout, ref));
    store.add(observe(visible, (shown) => (shown ? onShow : onHide).fire(), { immediate: false }));
    const descriptor = this.descriptor(ref.widgetId) ?? {
      id: ref.widgetId,
      title: ref.widgetId,
      kind: 'dock' as const,
      order: 0,
      openByDefault: false,
      singleton: true,
    };
    const record: InstanceRecord = {
      historyContext: descriptor.historyContext,
      store,
      instance: undefined as never,
    };
    const instance: WidgetInstance = {
      instanceId: ref.instanceId,
      descriptor,
      services: this._options.services,
      visible,
      onShow: onShow.event,
      onHide: onHide.event,
      getState: <T>() => this._state.get()[ref.instanceId] as T | undefined,
      setState: (state) => {
        this._state.update((all) => ({ ...all, [ref.instanceId]: state }));
        this._scheduleStateSave();
      },
      setHistoryContext: (contextId) => {
        record.historyContext = contextId;
        if (this._options.contextKeys.get(FOCUSED_WIDGET_KEY) === ref.instanceId) {
          this._options.contextKeys.set(HISTORY_CONTEXT_KEY, contextId);
        }
      },
    };
    (record as { instance: WidgetInstance }).instance = instance;
    this._instances.set(ref.instanceId, record);
    return instance;
  }

  /** Forgets an instance whose widget left the layout. */
  release(instanceId: string): void {
    const record = this._instances.get(instanceId);
    if (!record) return;
    this._instances.delete(instanceId);
    record.store.dispose();
  }

  /** Injects a view's styles while at least one of its instances is mounted. */
  useStyles(view: WidgetView, owner: string): Disposable {
    if (!view.styles) return toDisposable(() => undefined);
    let ref = this._styleRefs.get(view);
    if (!ref) {
      ref = {
        count: 0,
        sheet: this._options.styles.inject(owner, view.styles, { widgetId: view.id }),
      };
      this._styleRefs.set(view, ref);
    }
    ref.count++;
    return toDisposable(() => {
      if (--ref.count > 0) return;
      ref.sheet.dispose();
      this._styleRefs.delete(view);
    });
  }

  /**
   * Tracks focus inside `root`: `focusedWidget`, `historyContext` (undo target) and
   * `textInputFocus` (native undo) context keys.
   */
  trackFocus(root: HTMLElement): Disposable {
    const context = this._options.contextKeys;
    const update = () => {
      const active = root.ownerDocument.activeElement;
      const host = active?.closest<HTMLElement>('[data-nf-instance]');
      const instanceId = host?.dataset.nfInstance;
      const record = instanceId ? this._instances.get(instanceId) : undefined;
      context.set(FOCUSED_WIDGET_KEY, instanceId);
      context.set(HISTORY_CONTEXT_KEY, record?.historyContext ?? host?.dataset.nfHistory);
      context.set(TEXT_INPUT_FOCUS_KEY, isTextInput(active));
    };
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        update();
      });
    };
    root.addEventListener('focusin', schedule);
    root.addEventListener('focusout', schedule);
    return this._store.add(
      toDisposable(() => {
        root.removeEventListener('focusin', schedule);
        root.removeEventListener('focusout', schedule);
      }),
    );
  }

  dispose(): void {
    if (this._stateTimer) {
      clearTimeout(this._stateTimer);
      void this._saveState();
    }
    for (const record of this._instances.values()) record.store.dispose();
    this._instances.clear();
    this._store.dispose();
    this._onDidFail.dispose();
  }

  private _activate(widgetId: string): void {
    if (this._activations.has(widgetId)) return;
    const activation = this._options
      .activate(`onWidget:${widgetId}`)
      .then(() => {
        const registered = this._options.extensions
          .getValues(WIDGET_VIEWS)
          .some((view) => view.id === widgetId);
        if (!registered) this._fail(widgetId, 'Its plugin did not register a view for this panel.');
      })
      .catch((error: unknown) =>
        this._fail(widgetId, error instanceof Error ? error.message : String(error)),
      );
    this._activations.set(widgetId, activation);
  }

  private _fail(widgetId: string, reason: string): void {
    this._options.logger?.warn(`Panel ${widgetId} unavailable: ${reason}`);
    this._failed.set(widgetId, reason);
    this._onDidFail.fire(widgetId);
  }

  private _scheduleStateSave(): void {
    clearTimeout(this._stateTimer);
    this._stateTimer = setTimeout(() => {
      this._stateTimer = undefined;
      void this._saveState();
    }, 1000);
  }

  private async _saveState(): Promise<void> {
    const settings = this._options.settings;
    const scope = settings.hasStore('projectLocal') ? 'projectLocal' : 'machine';
    try {
      await settings.set(WidgetStateSetting, this._state.get(), scope);
    } catch (error) {
      this._options.logger?.warn('Saving panel states failed', error);
    }
  }
}

/** Whether an instance is on screen: active in its stack, in a shown slot or a float. */
export const isVisible = (layout: Layout, ref: WidgetRef): boolean => {
  if (layout.screens.includes(ref.instanceId)) return layout.activeScreen === ref.instanceId;
  if (layout.maximized && layout.maximized !== ref.instanceId) return false;
  const found = findWidget(layout, ref.instanceId);
  if (!found || !found.active) return false;
  return (
    found.location.kind === 'float' ||
    layout.maximized === ref.instanceId ||
    isSlotVisible(layout, found.location.slot)
  );
};

export const WorkbenchServiceToken = createToken<WorkbenchService>('ui.workbench');
