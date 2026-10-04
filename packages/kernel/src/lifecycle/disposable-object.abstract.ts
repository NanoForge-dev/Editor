import { type Disposable, DisposableStore } from './disposable';

/** Base class for services owning disposables through `this._register`. */
export abstract class DisposableObject implements Disposable {
  protected readonly _store = new DisposableStore();

  get isDisposed(): boolean {
    return this._store.isDisposed;
  }

  dispose(): void {
    this._store.dispose();
  }

  protected _register<T extends Disposable>(disposable: T): T {
    return this._store.add(disposable);
  }
}
