import { type z } from 'zod';

import type { Disposable } from '@nanoforge-dev/editor-kernel';

import type { Contract } from '../contract/contract.type';

export interface CallInfo {
  readonly namespace: string;
  readonly name: string;
  readonly kind: 'method' | 'stream';
  readonly public: boolean;
}

export type HandlerContext<Ctx> = Ctx & { readonly signal: AbortSignal };

/** What a stream handler may return to be notified when the subscription ends. */
export type StreamCleanup = Disposable | (() => void) | undefined;

export interface StreamSink<E> {
  emit(event: E): void;
  /** Ends the stream from the server side. */
  end(): void;
  error(error: unknown): void;
}

type MethodHandlers<C extends Contract, Ctx> = {
  [K in keyof C['methods']]: (
    input: z.output<C['methods'][K]['input']>,
    context: HandlerContext<Ctx>,
  ) => z.input<C['methods'][K]['output']> | Promise<z.input<C['methods'][K]['output']>>;
};

type StreamHandlers<C extends Contract, Ctx> = {
  [K in keyof C['streams']]: (
    params: z.output<C['streams'][K]['params']>,
    context: HandlerContext<Ctx>,
    sink: StreamSink<z.input<C['streams'][K]['event']>>,
  ) => StreamCleanup | Promise<StreamCleanup>;
};

export type Implementation<C extends Contract, Ctx> = {
  methods: MethodHandlers<C, Ctx>;
} & (keyof C['streams'] extends never
  ? { streams?: StreamHandlers<C, Ctx> }
  : { streams: StreamHandlers<C, Ctx> });

export interface RouterOptions<Ctx> {
  /** Throws (typically `RpcError('UNAUTHORIZED')`) to refuse a call or subscription. */
  authorize?: (context: Ctx, call: CallInfo) => void | Promise<void>;
  /** Reports unexpected (non RpcError) failures. */
  onError?: (error: unknown, call: CallInfo) => void;
  /** Maximum queued events per subscription before dropping the oldest. */
  maxQueuedEvents?: number;
}

export interface HttpResult {
  readonly status: number;
  readonly body: string;
}
