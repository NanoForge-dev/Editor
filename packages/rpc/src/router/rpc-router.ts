import { type Disposable, toDisposable } from '@nanoforge-dev/editor-kernel';

import { decode, encode } from '../codec/codec';
import type { Contract } from '../contract/contract.type';
import { RpcError } from '../error/rpc.exception';
import { type MethodEntry, type StreamEntry, toRpcError } from './router-entries';
import type { CallInfo, HttpResult, Implementation, RouterOptions } from './router.type';
import { RpcSession } from './rpc-session';

/**
 * Transport-agnostic RPC server: HTTP calls go through `handle`, WebSocket connections through
 * `createSession`. The server validates inputs and outputs against the contract.
 */
export class RpcRouter<Ctx extends object> {
  private readonly _methods = new Map<string, MethodEntry<Ctx>>();
  private readonly _streams = new Map<string, StreamEntry<Ctx>>();

  constructor(private readonly _options: RouterOptions<Ctx> = {}) {}

  implement<C extends Contract>(contract: C, implementation: Implementation<C, Ctx>): Disposable {
    const keys: string[] = [];
    const register = <T>(map: Map<string, T>, name: string, entry: T) => {
      const key = `${contract.namespace}.${name}`;
      if (map.has(key)) throw new Error(`RPC "${key}" is already implemented`);
      map.set(key, entry);
      keys.push(key);
    };
    for (const [name, definition] of Object.entries(contract.methods)) {
      const handler = (implementation.methods as Record<string, MethodEntry<Ctx>['handler']>)[name];
      if (!handler) throw new Error(`Missing handler for ${contract.namespace}.${name}`);
      register(this._methods, name, { definition, handler });
    }
    for (const [name, definition] of Object.entries(contract.streams)) {
      const handler = (
        implementation.streams as Record<string, StreamEntry<Ctx>['handler']> | undefined
      )?.[name];
      if (!handler) throw new Error(`Missing stream handler for ${contract.namespace}.${name}`);
      register(this._streams, name, { definition, handler });
    }
    return toDisposable(() => {
      for (const key of keys) {
        this._methods.delete(key);
        this._streams.delete(key);
      }
    });
  }

  /** Runs `<namespace>.<method>` with an encoded input body. */
  async handle(
    path: string,
    body: string,
    context: Ctx,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<HttpResult> {
    const entry = this._methods.get(path);
    const dot = path.lastIndexOf('.');
    const call: CallInfo = {
      namespace: path.slice(0, dot),
      name: path.slice(dot + 1),
      kind: 'method',
      public: entry?.definition.public ?? false,
    };
    try {
      if (!entry) throw new RpcError('NOT_FOUND', `Unknown RPC method "${path}"`);
      await this._options.authorize?.(context, call);
      let raw: unknown;
      try {
        raw = body ? decode(body) : undefined;
      } catch {
        throw new RpcError('BAD_REQUEST', 'Malformed request body');
      }
      const input = entry.definition.input.parse(raw);
      const result = await entry.handler(input, { ...context, signal });
      if (signal.aborted) throw new RpcError('CANCELLED', 'Request cancelled');
      const output = entry.definition.output.parse(result);
      return { status: 200, body: encode({ result: output }) };
    } catch (error) {
      const rpcError = toRpcError(error);
      if (rpcError.code === 'INTERNAL') this._options.onError?.(error, call);
      return { status: rpcError.status, body: encode({ error: rpcError.toJSON() }) };
    }
  }

  /**
   * Creates the server side of a WebSocket connection. `send` returns false when the socket is
   * back-pressured; call `drain` when it can accept data again.
   */
  createSession(context: Ctx, send: (message: string) => boolean): RpcSession {
    const lookup = (key: string) => this._streams.get(key) as StreamEntry<object> | undefined;
    return new RpcSession(lookup, context, send, this._options as RouterOptions<object>);
  }
}
