import type { BridgeEmitter, Listener } from './bridge-emitter.type';

/** Editor → engine: queued, drained by the engine at the start of each tick. */
export class QueuedEmitter implements BridgeEmitter {
  private readonly _listeners = new Map<string, Listener[]>();
  private _queue: [string, unknown[]][] = [];

  on(event: string, listener: Listener): void {
    this._listeners.set(event, [...(this._listeners.get(event) ?? []), listener]);
  }

  off(event: string, listener: Listener): void {
    this._listeners.set(
      event,
      (this._listeners.get(event) ?? []).filter((registered) => registered !== listener),
    );
  }

  emit(event: string, ...args: unknown[]): void {
    this._queue.push([event, args]);
  }

  runEvents(): void {
    const pending = this._queue;
    this._queue = [];
    for (const [event, args] of pending) {
      for (const listener of this._listeners.get(event) ?? []) {
        try {
          listener(...args);
        } catch (error) {
          console.error(error);
        }
      }
    }
  }
}
