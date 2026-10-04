/** Engine `EventEmitter` shape (`@nanoforge-dev/common`), the two sides of the editor bridge. */
export interface BridgeEmitter {
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  runEvents(): void;
}

export type Listener = (...args: unknown[]) => void;
