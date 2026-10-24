import type { Disposable } from '../lifecycle/disposable';
import { Emitter, type Listener } from './emitter';

/** Maps event keys to payload types. */
export type EventMap = object;

type EventKey<M extends EventMap> = keyof M & string;

/**
 * Typed publish/subscribe channel for loosely coupled editor parts. The editor-wide map is
 * `EditorEvents` of the SDK, which plugins extend by module augmentation.
 */
export class EventBus<M extends EventMap = Record<string, unknown>> implements Disposable {
  private readonly _emitters = new Map<string, Emitter<unknown>>();

  on<K extends EventKey<M>>(key: K, listener: Listener<M[K]>): Disposable {
    return this._emitter(key).event(listener as Listener<unknown>);
  }

  emit<K extends EventKey<M>>(key: K, payload: M[K]): void {
    this._emitters.get(key)?.fire(payload);
  }

  dispose(): void {
    for (const emitter of this._emitters.values()) emitter.dispose();
    this._emitters.clear();
  }

  private _emitter(key: string): Emitter<unknown> {
    let emitter = this._emitters.get(key);
    if (!emitter) {
      emitter = new Emitter({ onLastListenerRemove: () => this._emitters.delete(key) });
      this._emitters.set(key, emitter);
    }
    return emitter;
  }
}
