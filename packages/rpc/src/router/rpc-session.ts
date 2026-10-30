import type { Disposable } from '@nanoforge-dev/editor-kernel';

import { encode } from '../codec/codec';
import type { ClientMessage, ServerMessage } from '../contract/contract.type';
import { RpcError } from '../error/rpc.exception';
import { type StreamEntry, toRpcError } from './router-entries';
import type { CallInfo, RouterOptions, StreamCleanup, StreamSink } from './router.type';

interface Subscription {
  readonly id: number;
  readonly controller: AbortController;
  readonly coalesce: boolean;
  queue: string[];
  cleanup?: StreamCleanup;
  closed: boolean;
  /** Ended (or failed) while events still waited: it goes once they and the end are sent. */
  finishing?: boolean;
}

export class RpcSession implements Disposable {
  private readonly _subscriptions = new Map<number, Subscription>();
  private _blocked = false;
  private _closed = false;

  constructor(
    private readonly _lookup: (key: string) => StreamEntry<object> | undefined,
    private readonly _context: object,
    private readonly _send: (message: string) => boolean,
    private readonly _options: RouterOptions<object>,
  ) {}

  get subscriptionCount(): number {
    return this._subscriptions.size;
  }

  async receive(raw: string): Promise<void> {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    if (typeof message !== 'object' || message === null) return;
    switch (message.t) {
      case 'ping':
        this._write({ t: 'pong' });
        return;
      case 'unsub':
        this._close(message.id);
        return;
      case 'sub':
        await this._subscribe(message);
        return;
    }
  }

  /** Flushes queued events after back-pressure. */
  drain(): void {
    this._blocked = false;
    for (const subscription of this._subscriptions.values()) {
      while (subscription.queue.length && !this._blocked) {
        this._blocked = !this._send(subscription.queue.shift()!);
      }
      if (!subscription.queue.length && subscription.finishing)
        this._subscriptions.delete(subscription.id);
      if (this._blocked) return;
    }
  }

  dispose(): void {
    this._closed = true;
    for (const id of [...this._subscriptions.keys()]) this._close(id);
  }

  private async _subscribe(message: Extract<ClientMessage, { t: 'sub' }>): Promise<void> {
    const key = `${message.ns}.${message.topic}`;
    const entry = this._lookup(key);
    const call: CallInfo = {
      namespace: message.ns,
      name: message.topic,
      kind: 'stream',
      public: false,
    };
    if (this._subscriptions.has(message.id)) return;
    const subscription: Subscription = {
      id: message.id,
      controller: new AbortController(),
      coalesce: entry?.definition.coalesce ?? false,
      queue: [],
      closed: false,
    };
    this._subscriptions.set(message.id, subscription);
    try {
      if (!entry) throw new RpcError('NOT_FOUND', `Unknown RPC stream "${key}"`);
      await this._options.authorize?.(this._context, call);
      const params = entry.definition.params.parse(message.params);
      const sink: StreamSink<unknown> = {
        emit: (event) => {
          if (subscription.controller.signal.aborted) return;
          this._emit(message.id, subscription, entry.definition.event.parse(event));
        },
        end: () => this._finish(message.id, { t: 'end', id: message.id }),
        error: (error) => this._fail(message.id, error, call),
      };
      const cleanup = await entry.handler(
        params,
        { ...this._context, signal: subscription.controller.signal },
        sink,
      );
      if (subscription.controller.signal.aborted) {
        disposeCleanup(cleanup);
      } else if (cleanup) {
        subscription.cleanup = cleanup;
      }
    } catch (error) {
      this._fail(message.id, error, call);
    }
  }

  private _emit(id: number, subscription: Subscription, event: unknown): void {
    const text = JSON.stringify({ t: 'event', id, data: JSON.parse(encode(event)) });
    if (this._blocked) {
      if (subscription.coalesce) subscription.queue = [text];
      else {
        subscription.queue.push(text);
        const max = this._options.maxQueuedEvents ?? 10_000;
        if (subscription.queue.length > max) subscription.queue.shift();
      }
      return;
    }
    this._blocked = !this._send(text);
  }

  private _fail(id: number, error: unknown, call: CallInfo): void {
    const rpcError = toRpcError(error);
    if (rpcError.code === 'INTERNAL') this._options.onError?.(error, call);
    this._finish(id, { t: 'error', id, error: rpcError.toJSON() });
  }

  /**
   * Ends a subscription with its last message. Events still queued by back-pressure go first:
   * the end waits behind them, and the subscription goes once they are sent.
   */
  private _finish(id: number, message: ServerMessage): void {
    const subscription = this._subscriptions.get(id);
    if (!subscription?.queue.length || subscription.finishing) {
      this._write(message);
      this._close(id);
      return;
    }
    subscription.queue.push(JSON.stringify(message));
    subscription.finishing = true;
    subscription.closed = true;
    subscription.controller.abort();
    disposeCleanup(subscription.cleanup);
  }

  private _write(message: ServerMessage): void {
    if (this._closed && message.t !== 'end') return;
    this._blocked = !this._send(JSON.stringify(message)) || this._blocked;
  }

  private _close(id: number): void {
    const subscription = this._subscriptions.get(id);
    if (!subscription || subscription.closed) return;
    subscription.closed = true;
    subscription.controller.abort();
    this._subscriptions.delete(id);
    disposeCleanup(subscription.cleanup);
  }
}

const disposeCleanup = (cleanup: StreamCleanup) => {
  if (!cleanup) return;
  if (typeof cleanup === 'function') cleanup();
  else cleanup.dispose();
};
