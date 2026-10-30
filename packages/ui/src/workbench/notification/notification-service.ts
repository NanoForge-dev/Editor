import { type Observable, ObservableValue, createToken } from '@nanoforge-dev/editor-kernel';

export type Severity = 'info' | 'success' | 'warning' | 'error';

export interface NotificationAction {
  readonly title: string;
  readonly run: () => void | Promise<void>;
}

export interface Notification {
  readonly id: number;
  readonly severity: Severity;
  readonly message: string;
  readonly detail?: string;
  readonly actions: readonly NotificationAction[];
  readonly source?: string;
  readonly time: number;
}

export interface NotifyOptions {
  readonly detail?: string;
  readonly actions?: readonly NotificationAction[];
  readonly source?: string;
  /** Auto dismiss delay in ms; errors stay until dismissed. Default 5000 (0 = sticky). */
  readonly timeout?: number;
}

interface Timer {
  handle?: ReturnType<typeof setTimeout>;
  remaining: number;
  started: number;
}

/**
 * Toasts and the notification center history. Toasts that dismiss themselves wait while they
 * are held (pointer or focus on them), so they can be read and acted on (WCAG 2.2.1).
 */
export class NotificationService {
  private readonly _active = new ObservableValue<readonly Notification[]>([]);
  private readonly _history = new ObservableValue<readonly Notification[]>([]);
  private readonly _timers = new Map<number, Timer>();
  private _held = false;
  private _nextId = 1;

  /** Notifications currently shown as toasts. */
  get active(): Observable<readonly Notification[]> {
    return this._active.readonly();
  }

  /** Every notification of the session (notification center). */
  get history(): Observable<readonly Notification[]> {
    return this._history.readonly();
  }

  notify(severity: Severity, message: string, options: NotifyOptions = {}): { dismiss(): void } {
    const notification: Notification = {
      id: this._nextId++,
      severity,
      message,
      actions: options.actions ?? [],
      time: Date.now(),
      ...(options.detail && { detail: options.detail }),
      ...(options.source && { source: options.source }),
    };
    this._active.update((list) => [...list, notification]);
    this._history.update((list) => [notification, ...list].slice(0, 200));
    const timeout = options.timeout ?? (severity === 'error' ? 0 : 5000);
    const dismiss = () => this.dismiss(notification.id);
    if (timeout > 0) {
      const timer: Timer = { remaining: timeout, started: Date.now() };
      this._timers.set(notification.id, timer);
      if (!this._held) this._start(notification.id, timer);
    }
    return { dismiss };
  }

  dismiss(id: number): void {
    clearTimeout(this._timers.get(id)?.handle);
    this._timers.delete(id);
    this._active.update((list) => list.filter((notification) => notification.id !== id));
    if (!this._active.get().length) this.release();
  }

  /** Stops the toasts' countdowns until `release` (the pointer or the focus is on them). */
  hold(): void {
    if (this._held) return;
    this._held = true;
    for (const timer of this._timers.values()) {
      clearTimeout(timer.handle);
      timer.handle = undefined;
      timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.started));
    }
  }

  /** Starts the countdowns again, each with the time it had left (2 s at least). */
  release(): void {
    if (!this._held) return;
    this._held = false;
    for (const [id, timer] of this._timers) {
      timer.remaining = Math.max(timer.remaining, 2000);
      this._start(id, timer);
    }
  }

  clearHistory(): void {
    this._history.set([]);
  }

  private _start(id: number, timer: Timer): void {
    timer.started = Date.now();
    timer.handle = setTimeout(() => this.dismiss(id), timer.remaining);
  }
}

export const NotificationServiceToken = createToken<NotificationService>('ui.notifications');
