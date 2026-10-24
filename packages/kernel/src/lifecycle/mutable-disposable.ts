import type { Disposable } from './disposable';

/** Holds at most one disposable; replacing or clearing it disposes the previous one. */
export class MutableDisposable<T extends Disposable = Disposable> implements Disposable {
  private _value: T | undefined;
  private _disposed = false;

  get value(): T | undefined {
    return this._value;
  }

  set value(value: T | undefined) {
    if (this._disposed) {
      value?.dispose();
      return;
    }
    if (value === this._value) return;
    const previous = this._value;
    this._value = value;
    previous?.dispose();
  }

  clear(): void {
    this.value = undefined;
  }

  dispose(): void {
    if (this._disposed) return;
    this.clear();
    this._disposed = true;
  }
}
