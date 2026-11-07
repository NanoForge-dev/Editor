import type { BridgeEmitter } from './bridge-emitter.type';

/**
 * Engine → editor: delivered to the editor in a microtask (nothing drains it), so editor code
 * never runs inside an engine tick (the engine tells game console output from the editor's).
 */
export class DirectEmitter implements BridgeEmitter {
  constructor(private readonly _deliver: (event: string, args: unknown[]) => void) {}

  on(): void {}

  off(): void {}

  emit(event: string, ...args: unknown[]): void {
    queueMicrotask(() => this._deliver(event, args));
  }

  runEvents(): void {}
}
