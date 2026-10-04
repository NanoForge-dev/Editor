import type { z } from 'zod';

import type { Contract } from '../contract/contract.type';

export type RpcApi<C extends Contract> = {
  [K in keyof C['methods']]: (
    input: z.input<C['methods'][K]['input']>,
    options?: { signal?: AbortSignal },
  ) => Promise<z.output<C['methods'][K]['output']>>;
};

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

/** Minimal WebSocket surface (browser WebSocket, `ws`, test doubles). */
export interface SocketLike {
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface RpcClientOptions {
  /** Origin of the editor server, e.g. `http://localhost:5173`. */
  baseUrl: string;
  fetch?: typeof fetch;
  /** Extra headers per call (active project, …). */
  headers?: () => Record<string, string>;
  createSocket?: (url: string) => SocketLike;
  heartbeatMs?: number;
  /** Reconnect delays in ms; the last one repeats. */
  reconnectDelays?: readonly number[];
}
