import type { z } from 'zod';

import {
  type Disposable,
  Emitter,
  type Event,
  type Observable,
  ObservableValue,
  createToken,
  toDisposable,
} from '@nanoforge-dev/editor-kernel';

import { decode, encode } from '../codec/codec';
import type { ClientMessage, Contract, ServerMessage } from '../contract/contract.type';
import { RPC_HTTP_PREFIX, RPC_WS_PATH } from '../contract/rpc.const';
import {
  RPC_ERROR_STATUS,
  RpcError,
  type RpcErrorCode,
  type RpcErrorPayload,
} from '../error/rpc.exception';
import type { ConnectionState, RpcApi, RpcClientOptions, SocketLike } from './rpc-client.type';

interface ActiveSubscription {
  readonly message: Extract<ClientMessage, { t: 'sub' }>;
  readonly onEvent: (data: unknown) => void;
  readonly onError: (error: RpcError) => void;
  readonly onEnd: () => void;
}

const OPEN = 1;

const statusCode = (status: number): RpcErrorCode =>
  (Object.entries(RPC_ERROR_STATUS).find(([, value]) => value === status)?.[0] as RpcErrorCode) ??
  (status >= 500 ? 'INTERNAL' : 'BAD_REQUEST');

export class RpcClient implements Disposable {
  private readonly _fetch: typeof fetch;
  private readonly _subscriptions = new Map<number, ActiveSubscription>();
  private readonly _state = new ObservableValue<ConnectionState>('idle');
  private readonly _onDidReconnect = new Emitter<void>();
  private _socket: SocketLike | undefined;
  private _nextId = 1;
  private _attempt = 0;
  private _heartbeat: ReturnType<typeof setInterval> | undefined;
  private _reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private _awaitingPong = false;
  private _disposed = false;

  /** Fires after the socket reconnected and subscriptions were restored. */
  readonly onDidReconnect: Event<void> = this._onDidReconnect.event;

  constructor(private readonly _options: RpcClientOptions) {
    this._fetch = _options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  get state(): Observable<ConnectionState> {
    return this._state.readonly();
  }

  /** Typed proxy over a contract's methods. */
  api<C extends Contract>(contract: C): RpcApi<C> {
    const api: Record<string, unknown> = {};
    for (const method of Object.keys(contract.methods)) {
      api[method] = (input: unknown, options?: { signal?: AbortSignal }) =>
        this.call(`${contract.namespace}.${method}`, input, options?.signal);
    }
    return api as RpcApi<C>;
  }

  async call(path: string, input: unknown, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await this._fetch(new URL(`${RPC_HTTP_PREFIX}${path}`, this._options.baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this._options.headers?.() },
        body: encode(input ?? null),
        ...(signal && { signal }),
      });
    } catch (error) {
      if (signal?.aborted) throw new RpcError('CANCELLED', 'Request cancelled');
      throw new RpcError('UNAVAILABLE', `Editor server unreachable: ${String(error)}`);
    }
    const text = await response.text();
    let payload: { result?: unknown; error?: RpcErrorPayload | string };
    try {
      payload = decode(text);
    } catch {
      throw new RpcError(statusCode(response.status), `Unexpected response (${response.status})`);
    }
    if (typeof payload.error === 'object') throw RpcError.from(payload.error);
    if (!response.ok || payload.error !== undefined) {
      throw new RpcError(statusCode(response.status), String(payload.error ?? response.statusText));
    }
    return payload.result;
  }

  /** Subscribes to a stream; the subscription survives reconnections. */
  subscribe<C extends Contract, K extends keyof C['streams'] & string>(
    contract: C,
    topic: K,
    params: z.input<C['streams'][K]['params']>,
    onEvent: (event: z.output<C['streams'][K]['event']>) => void,
    handlers: { onError?: (error: RpcError) => void; onEnd?: () => void } = {},
  ): Disposable {
    const id = this._nextId++;
    const message: ClientMessage = { t: 'sub', id, ns: contract.namespace, topic, params };
    this._subscriptions.set(id, {
      message,
      onEvent: onEvent as (data: unknown) => void,
      onError: handlers.onError ?? (() => undefined),
      onEnd: handlers.onEnd ?? (() => undefined),
    });
    this._ensureSocket();
    this._sendRaw(message);
    return toDisposable(() => {
      if (!this._subscriptions.delete(id)) return;
      this._sendRaw({ t: 'unsub', id });
    });
  }

  dispose(): void {
    this._disposed = true;
    clearTimeout(this._reconnectTimer);
    this._stopHeartbeat();
    this._subscriptions.clear();
    const socket = this._socket;
    this._socket = undefined;
    socket?.close();
    this._state.set('closed');
    this._onDidReconnect.dispose();
  }

  private _ensureSocket(): void {
    if (this._socket || this._disposed) return;
    const url = new URL(RPC_WS_PATH, this._options.baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const create =
      this._options.createSocket ?? ((target: string) => new WebSocket(target) as SocketLike);
    const socket = create(url.href);
    this._socket = socket;
    this._state.set(this._attempt === 0 ? 'connecting' : 'reconnecting');

    socket.onopen = () => {
      const reconnected = this._attempt > 0;
      this._attempt = 0;
      this._state.set('open');
      for (const subscription of this._subscriptions.values()) this._sendRaw(subscription.message);
      this._startHeartbeat();
      if (reconnected) this._onDidReconnect.fire();
    };
    socket.onmessage = (event) => this._receive(String(event.data));
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this._socket !== socket) return;
      this._socket = undefined;
      this._stopHeartbeat();
      if (this._disposed) return;
      if (!this._subscriptions.size) {
        this._state.set('idle');
        return;
      }
      this._scheduleReconnect();
    };
  }

  private _scheduleReconnect(): void {
    const delays = this._options.reconnectDelays ?? [250, 500, 1000, 2000, 5000];
    const delay = delays[Math.min(this._attempt, delays.length - 1)]!;
    this._attempt++;
    this._state.set('reconnecting');
    this._reconnectTimer = setTimeout(() => this._ensureSocket(), delay);
  }

  private _receive(raw: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    if (message.t === 'pong') {
      this._awaitingPong = false;
      return;
    }
    const subscription = this._subscriptions.get(message.id);
    if (!subscription) return;
    switch (message.t) {
      case 'event':
        subscription.onEvent(decode(JSON.stringify(message.data)));
        return;
      case 'error':
        this._subscriptions.delete(message.id);
        subscription.onError(RpcError.from(message.error as RpcErrorPayload));
        return;
      case 'end':
        this._subscriptions.delete(message.id);
        subscription.onEnd();
    }
  }

  private _sendRaw(message: ClientMessage): void {
    if (this._socket?.readyState === OPEN) this._socket.send(JSON.stringify(message));
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    const interval = this._options.heartbeatMs ?? 20_000;
    this._heartbeat = setInterval(() => {
      if (this._awaitingPong) {
        this._socket?.close();
        return;
      }
      this._awaitingPong = true;
      this._sendRaw({ t: 'ping' });
    }, interval);
  }

  private _stopHeartbeat(): void {
    clearInterval(this._heartbeat);
    this._heartbeat = undefined;
    this._awaitingPong = false;
  }
}

/** The editor's RPC client, for plugins calling their own server entry. */
export const RpcClientToken = createToken<RpcClient>('rpc.client');
