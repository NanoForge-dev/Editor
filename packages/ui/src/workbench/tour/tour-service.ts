import {
  type CommandRegistry,
  type ContextKeyService,
  type Disposable,
  DisposableStore,
  type ExtensionRegistry,
  type Observable,
  ObservableValue,
  createToken,
} from '@nanoforge-dev/editor-kernel';

import { notifyError } from '../notification/describe-error';
import type { NotificationService } from '../notification/notification-service';
import { TOURS, type Tour, type TourStep } from './tour.extension-point';

/** The tour shown, and its step. */
export interface TourState {
  readonly tour: Tour;
  readonly step: TourStep;
  /** Position among the steps shown in this editor (steps whose `when` is false are left out). */
  readonly position: number;
  readonly count: number;
}

/**
 * Runs tours (`TOURS`): one step at a time, forward and back, ahead by itself when a step's
 * condition is met (`advanceWhen`, `advanceWhenChanged`). Steps whose `when` is false here (a
 * hosted editor, no project) are skipped.
 */
export class TourService implements Disposable {
  private readonly _state = new ObservableValue<TourState | undefined>(undefined);
  private readonly _store = new DisposableStore();
  private _index = 0;
  /**
   * The steps counted in "n of m": those that applied when the tour started, and those shown
   * since (the count never shrinks while the tour goes).
   */
  private _counted = new Set<TourStep>();
  /** The value of the step's `advanceWhenChanged` key when the step began. */
  private _initial: unknown;
  /**
   * The step's `advanceWhen` held when Back reached it: it goes on only once the condition
   * turns false then true again, or Back would bounce straight forward.
   */
  private _metOnArrival = false;

  constructor(
    private readonly _extensions: ExtensionRegistry,
    private readonly _contextKeys: ContextKeyService,
    private readonly _commands: CommandRegistry,
    private readonly _notifications?: NotificationService,
  ) {
    this._store.add(this._contextKeys.onDidChange(() => this._check()));
  }

  get state(): Observable<TourState | undefined> {
    return this._state.readonly();
  }

  tours(): Tour[] {
    return this._extensions.getValues(TOURS);
  }

  /** Starts a tour from its first step; false when there is no such tour or no step to show. */
  start(id: string): boolean {
    const tour = this.tours().find((candidate) => candidate.id === id);
    if (!tour) return false;
    this._counted = new Set(tour.steps.filter((step) => this._contextKeys.evaluate(step.when)));
    return this._go(tour, 0, 1);
  }

  next(): void {
    const state = this._state.get();
    if (!state) return;
    if (!this._go(state.tour, this._index + 1, 1)) this.stop();
  }

  back(): void {
    const state = this._state.get();
    if (state) this._go(state.tour, this._index - 1, -1);
  }

  stop(): void {
    this._state.set(undefined);
  }

  /** Runs the step's action (its command); a failure is shown as a notification. */
  async act(): Promise<void> {
    const action = this._state.get()?.step.action;
    if (!action) return;
    try {
      await this._commands.execute(action.command, ...action.args);
    } catch (error) {
      notifyError(this._notifications, `${action.title} failed`, error);
    }
  }

  dispose(): void {
    this._store.dispose();
    this._state.set(undefined);
  }

  /** Shows the first step from `index` (in `direction`) whose `when` holds; false if none. */
  private _go(tour: Tour, index: number, direction: 1 | -1): boolean {
    for (let i = index; i >= 0 && i < tour.steps.length; i += direction) {
      const step = tour.steps[i]!;
      if (!this._contextKeys.evaluate(step.when)) continue;
      this._index = i;
      this._counted.add(step);
      this._initial = step.advanceWhenChanged
        ? this._contextKeys.get(step.advanceWhenChanged)
        : undefined;
      this._metOnArrival =
        direction < 0 &&
        step.advanceWhen !== undefined &&
        this._contextKeys.evaluate(step.advanceWhen);
      const counted = tour.steps.filter((candidate) => this._counted.has(candidate));
      const position = tour.steps
        .slice(0, i + 1)
        .filter((candidate) => this._counted.has(candidate)).length;
      this._state.set({
        tour,
        step,
        position: Math.max(1, position),
        count: Math.max(counted.length, position),
      });
      this._check();
      return true;
    }
    return false;
  }

  private _check(): void {
    const state = this._state.get();
    if (!state) return;
    const { step } = state;
    const key = step.advanceWhenChanged;
    const value = key === undefined ? undefined : this._contextKeys.get(key);
    /** A key not set yet when the step began (its plugin was not up): its first value is the start. */
    if (key !== undefined && this._initial === undefined) this._initial = value;
    const changed = key !== undefined && value !== this._initial;
    const holds = step.advanceWhen !== undefined && this._contextKeys.evaluate(step.advanceWhen);
    const met = holds && !this._metOnArrival;
    if (!holds) this._metOnArrival = false;
    if (changed || met) queueMicrotask(() => this._state.get()?.step === step && this.next());
  }
}

export const TourServiceToken = createToken<TourService>('ui.tours');
