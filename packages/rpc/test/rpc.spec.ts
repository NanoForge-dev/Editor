import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { toDisposable } from '@nanoforge-dev/editor-kernel';

import { RpcError, RpcRouter, defineContract } from '../src';
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
  return { router, emitters, cleanup, internal, emitStatus: (n: number) => emitStatus(n) };
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
    emitStatus(1); // accepted, then the socket reports back-pressure
    emitStatus(2);
    emitStatus(3);
    socket.backpressure = false;
    socket.session!.drain();
    await flush();
    expect(values).toEqual([1, 3]);
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
