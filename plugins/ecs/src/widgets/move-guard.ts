/**
 * True from a move until the model shows it (2 s at most): a key pressed again before that
 * would read the old order, so it waits for the next press.
 */
export class MoveGuard {
  private _busy = false;
  private _timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly _timeout = 2000) {}

  /** A move is on its way: further moves wait. */
  get busy(): boolean {
    return this._busy;
  }

  /** Starts a move, released by `done` or after the timeout. */
  start(): void {
    this._busy = true;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => (this._busy = false), this._timeout);
  }

  /** The model shows the move, or it failed: the next one may go. */
  done(): void {
    this._busy = false;
    clearTimeout(this._timer);
  }
}
