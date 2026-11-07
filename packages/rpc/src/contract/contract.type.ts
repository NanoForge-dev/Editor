import type { z } from 'zod';

export interface MethodDefinition<
  I extends z.ZodType = z.ZodType,
  O extends z.ZodType = z.ZodType,
> {
  readonly input: I;
  readonly output: O;
  /** Callable without an authenticated session. */
  readonly public?: boolean;
}

export interface StreamDefinition<
  P extends z.ZodType = z.ZodType,
  E extends z.ZodType = z.ZodType,
> {
  readonly params: P;
  readonly event: E;
  /**
   * When the client cannot keep up, only the latest pending event is kept (state snapshots).
   * Otherwise events are queued (change logs).
   */
  readonly coalesce?: boolean;
}

export type MethodMap = Record<string, MethodDefinition>;
export type StreamMap = Record<string, StreamDefinition>;

export interface Contract<
  N extends string = string,
  M extends MethodMap = MethodMap,
  S extends StreamMap = StreamMap,
> {
  readonly namespace: N;
  readonly methods: M;
  readonly streams: S;
}

export type MethodInput<C extends Contract, K extends keyof C['methods']> = z.input<
  C['methods'][K]['input']
>;
export type MethodOutput<C extends Contract, K extends keyof C['methods']> = z.output<
  C['methods'][K]['output']
>;
export type StreamParams<C extends Contract, K extends keyof C['streams']> = z.input<
  C['streams'][K]['params']
>;
export type StreamEvent<C extends Contract, K extends keyof C['streams']> = z.output<
  C['streams'][K]['event']
>;

/** Wire messages of the WebSocket channel. */
export type ClientMessage =
  | { t: 'sub'; id: number; ns: string; topic: string; params: unknown }
  | { t: 'unsub'; id: number }
  | { t: 'ping' };

export type ServerMessage =
  | { t: 'event'; id: number; data: unknown }
  | { t: 'error'; id: number; error: { code: string; message: string; data?: unknown } }
  | { t: 'end'; id: number }
  | { t: 'pong' };
