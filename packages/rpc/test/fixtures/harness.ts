import { RpcClient } from '../../src/client/rpc-client';
import type { SocketLike } from '../../src/client/rpc-client.type';
import type { RpcRouter } from '../../src/router/rpc-router';
import type { RpcSession } from '../../src/router/rpc-session';

/** In-memory socket connected to a router session. */
export class FakeSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  onmessage: SocketLike['onmessage'] = null;
  session: RpcSession | undefined;
  /** When true, the server side reports back-pressure. */
  backpressure = false;
  readonly sent: string[] = [];

  constructor(
    private readonly router: RpcRouter<{ user: string }>,
    private readonly context: { user: string },
  ) {
    queueMicrotask(() => this.open());
  }

  open(): void {
    this.session = this.router.createSession(this.context, (message) => {
      if (this.readyState !== 1) return false;
      queueMicrotask(() => this.onmessage?.({ data: message }));
      return !this.backpressure;
    });
    this.readyState = 1;
    this.onopen?.({});
  }

  send(data: string): void {
    this.sent.push(data);
    void this.session?.receive(data);
  }

  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.session?.dispose();
    queueMicrotask(() => this.onclose?.({}));
  }
}

export const connect = (
  router: RpcRouter<{ user: string }>,
  context = { user: 'alice' },
  options: { heartbeatMs?: number } = {},
) => {
  const sockets: FakeSocket[] = [];
  const client = new RpcClient({
    baseUrl: 'http://editor.test',
    reconnectDelays: [1],
    ...options,
    fetch: async (url, init) => {
      const path = new URL(String(url)).pathname.replace('/rpc/', '');
      const result = await router.handle(
        path,
        String(init?.body ?? ''),
        context,
        init?.signal ?? undefined,
      );
      return new Response(result.body, { status: result.status });
    },
    createSocket: () => {
      const socket = new FakeSocket(router, context);
      sockets.push(socket);
      return socket;
    },
  });
  return { client, sockets };
};

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
