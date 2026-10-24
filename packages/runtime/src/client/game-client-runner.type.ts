import type { LogValue } from '@nanoforge-dev/editor-kernel';
import type { OutputManifest } from '@nanoforge-dev/editor-protocol';

import type { BridgeEmitter } from '../bridge/bridge-emitter.type';

/** What a built client exports (`ClientRunOptions` of the engine). */
export interface GameClientModule {
  main(options: {
    container: HTMLDivElement;
    files: Map<string, string>;
    env: Record<string, string>;
    editor: {
      toEditor: BridgeEmitter;
      fromEditor: BridgeEmitter;
      /** Snapshots logged values in the editor's format (the engine has no serializer of its own). */
      serializeLogValue: (value: unknown) => LogValue;
    };
  }): Promise<void> | void;
}

export interface ClientRunnerOptions {
  /** Loads the game bundle (`import()` in browsers). */
  readonly importModule: (url: string) => Promise<GameClientModule>;
  /** Engine → editor events (`hello`, `state`, custom events). */
  readonly onEvent: (event: string, args: unknown[]) => void;
  /** Uncaught errors thrown by the game code. */
  readonly onError: (error: unknown) => void;
  /** Where uncaught errors are observed (defaults to `globalThis`). */
  readonly errorTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

export interface ClientRunTarget {
  /** Element the game container is added to. */
  readonly host: HTMLElement;
  readonly manifest: OutputManifest;
  readonly env: Record<string, string>;
  /** Origin the build output is served from (`location.origin`). */
  readonly origin: string;
}
