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

/** Toasts and the notification center history. */
export class NotificationService {
  private readonly _active = new ObservableValue<readonly Notification[]>([]);
  private readonly _history = new ObservableValue<readonly Notification[]>([]);
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
    if (timeout > 0) setTimeout(dismiss, timeout);
    return { dismiss };
  }

  dismiss(id: number): void {
    this._active.update((list) => list.filter((notification) => notification.id !== id));
  }

  clearHistory(): void {
    this._history.set([]);
  }
}

export const NotificationServiceToken = createToken<NotificationService>('ui.notifications');
