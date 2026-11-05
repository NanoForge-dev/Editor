import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { toDisposable } from '@nanoforge-dev/editor-kernel';

import { RpcClient, RpcError, RpcRouter, defineContract } from '../src';
import { connect, flush } from './fixtures/harness';

const Files = defineContract('fs', {
  methods: {
    read: {
      input: z.object({ path: z.string().min(1) }),
      output: z.object({ content: z.instanceof(Uint8Array), size: z.number() }),
    },
    fail: { input: z.null(), output: z.null() },
    version: { input: z.null(), output: z.string(), public: true },
  },
  streams: {
    changes: {
      params: z.object({ glob: z.string() }),
      event: z.object({ path: z.string() }),
    },
    status: { params: z.null(), event: z.number(), coalesce: true },
  },
});

const createRouter = () => {
  const emitters = new Map<string, (path: string) => void>();
  const enders = new Map<string, () => void>();
  let emitStatus: (n: number) => void = () => undefined;
  const cleanup = vi.fn();
  const internal = vi.fn();
  const router = new RpcRouter<{ user: string }>({
    authorize: (context, call) => {
      if (!call.public && context.user !== 'alice') throw new RpcError('UNAUTHORIZED', 'login');
    },
    onError: internal,
  });
  router.implement(Files, {
    methods: {
      read: ({ path }) => ({ content: new TextEncoder().encode(path), size: path.length }),
      fail: () => {
        throw new Error('database exploded');
      },
      version: () => '1.0.0',
    },
    streams: {
      changes: ({ glob }, _context, sink) => {
        emitters.set(glob, (path) => sink.emit({ path }));
        enders.set(glob, () => sink.end());
        return toDisposable(() => {
          emitters.delete(glob);
          cleanup(glob);
        });
      },
      status: (_params, _context, sink) => {
        emitStatus = (n) => sink.emit(n);
      },
    },
  });
  return {
    router,
    emitters,
    enders,
    cleanup,
    internal,
    emitStatus: (n: number) => emitStatus(n),
  };
};

describe('RPC calls', () => {
  it('calls typed methods with binary payloads', async () => {
    const { router } = createRouter();
    const { client } = connect(router);
    const result = await client.api(Files).read({ path: 'main.ts' });
    expect(new TextDecoder().decode(result.content)).toBe('main.ts');
    expect(result.size).toBe(7);
  });

  it('validates inputs', async () => {
    const { router } = createRouter();
    const { client } = connect(router);
    await expect(client.api(Files).read({ path: '' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('hides internal errors and reports them', async () => {
    const { router, internal } = createRouter();
    const { client } = connect(router);
    const error = await client
      .api(Files)
      .fail(null)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RpcError);
    expect(error).toMatchObject({ code: 'INTERNAL', message: 'Internal error' });
    expect(internal).toHaveBeenCalledOnce();
  });

  it('authorizes non public methods', async () => {
    const { router } = createRouter();
    const { client } = connect(router, { user: 'mallory' });
    await expect(client.api(Files).version(null)).resolves.toBe('1.0.0');
    await expect(client.api(Files).read({ path: 'x' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(client.call('fs.missing', null)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('RPC streams', () => {
  it('delivers events until unsubscribed', async () => {
    const { router, emitters, cleanup } = createRouter();
    const { client } = connect(router);
    const events: string[] = [];
    const subscription = client.subscribe(Files, 'changes', { glob: '**/*.ts' }, (e) =>
      events.push(e.path),
    );
    await flush();
    emitters.get('**/*.ts')!('a.ts');
    await flush();
    subscription.dispose();
    await flush();
    expect(events).toEqual(['a.ts']);
    expect(cleanup).toHaveBeenCalledWith('**/*.ts');
  });

  it('resubscribes after a reconnection', async () => {
    const { router, emitters } = createRouter();
    const { client, sockets } = connect(router);
    const events: string[] = [];
    const reconnected = vi.fn();
    client.onDidReconnect(reconnected);
    client.subscribe(Files, 'changes', { glob: '*' }, (e) => events.push(e.path));
    await flush();
    sockets[0]!.close();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sockets).toHaveLength(2);
    expect(reconnected).toHaveBeenCalledOnce();
    emitters.get('*')!('after.ts');
    await flush();
    expect(events).toEqual(['after.ts']);
    expect(client.state.get()).toBe('open');
  });

  it('reports stream errors', async () => {
    const { router } = createRouter();
    const { client } = connect(router, { user: 'mallory' });
    const onError = vi.fn();
    client.subscribe(Files, 'changes', { glob: '*' }, () => undefined, { onError });
    await flush();
    await flush();
    expect(onError.mock.calls[0]![0]).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('coalesces snapshot streams under back-pressure', async () => {
    const { router, emitStatus } = createRouter();
    const { client, sockets } = connect(router);
    const values: number[] = [];
    client.subscribe(Files, 'status', null, (n) => values.push(n));
    await flush();
    const socket = sockets[0]!;
    socket.backpressure = true;
    /** Accepted, then the socket reports back-pressure. */
    emitStatus(1);
    emitStatus(2);
    emitStatus(3);
    socket.backpressure = false;
    socket.session!.drain();
    await flush();
    expect(values).toEqual([1, 3]);
  });

  it('ends a stream after the events back-pressure held back', async () => {
    const { router, emitters, enders, cleanup } = createRouter();
    const { client, sockets } = connect(router);
    const received: string[] = [];
    client.subscribe(Files, 'changes', { glob: '*' }, (event) => received.push(event.path), {
      onEnd: () => received.push('end'),
    });
    await flush();
    const socket = sockets[0]!;
    socket.backpressure = true;
    emitters.get('*')!('a.ts');
    emitters.get('*')!('b.ts');
    emitters.get('*')!('c.ts');
    enders.get('*')!();
    expect(cleanup).toHaveBeenCalledWith('*');
    socket.backpressure = false;
    socket.session!.drain();
    await flush();
    expect(received).toEqual(['a.ts', 'b.ts', 'c.ts', 'end']);
    expect(socket.session!.subscriptionCount).toBe(0);
  });

  it('closes dead connections through the heartbeat', async () => {
    vi.useFakeTimers();
    const { router } = createRouter();
    const { client, sockets } = connect(router, undefined, { heartbeatMs: 1000 });
    client.subscribe(Files, 'changes', { glob: '*' }, () => undefined);
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]!.session!.receive = async () => undefined;
    await vi.advanceTimersByTimeAsync(2100);
    expect(sockets[0]!.readyState).toBe(3);
    vi.useRealTimers();
  });
});

describe('RpcRouter.implement', () => {
  const Greeter = defineContract('greeter', {
    methods: { hi: { input: z.null(), output: z.string() } },
    streams: { ticks: { params: z.null(), event: z.number() } },
  });

  it('registers nothing when a handler is missing', () => {
    const router = new RpcRouter<object>();
    expect(() => router.implement(Greeter, { methods: { hi: () => 'hi' } } as never)).toThrow(
      'Missing stream handler for greeter.ticks',
    );
    expect(() =>
      router.implement(Greeter, { methods: { hi: () => 'hi' }, streams: { ticks: () => {} } }),
    ).not.toThrow();
  });

  it('accepts a hand-written contract without streams', () => {
    const router = new RpcRouter<object>();
    const contract = { namespace: 'plain', methods: { hi: Greeter.methods.hi } };
    const implement = () =>
      router.implement(contract as never, { methods: { hi: () => 'hi' } } as never);
    const registration = implement();
    expect(implement).toThrow('RPC "plain.hi" is already implemented');
    registration.dispose();
    expect(implement).not.toThrow();
  });
});

describe('RpcClient timeouts', () => {
  /** A server that accepts the request and never answers. */
  const silent = () =>
    new RpcClient({
      baseUrl: 'http://editor.test',
      fetch: ((_url: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)),
        )) as typeof fetch,
    });

  it('gives up after timeoutMs with a TIMEOUT error', async () => {
    await expect(silent().api(Files).version(null, { timeoutMs: 20 })).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('reports a cancelled call as cancelled, not timed out', async () => {
    const controller = new AbortController();
    const call = silent().api(Files).version(null, { signal: controller.signal, timeoutMs: 1000 });
    controller.abort();
    await expect(call).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
