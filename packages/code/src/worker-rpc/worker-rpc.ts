/**
 * Minimal typed RPC over `postMessage` (a web worker, a MessagePort): the other side's
 * methods become async functions. Errors are rethrown with their message and name.
 */
export interface MessageEndpoint {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  addEventListener(type: 'error' | 'messageerror', listener: (event: Event) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'error' | 'messageerror', listener: (event: Event) => void): void;
  start?(): void;
}

/** A worker failed (crashed, or sent what could not be read): its calls will never answer. */
export class WorkerFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkerFailedError';
  }
}

type AnyFunction = (...args: never[]) => unknown;

/** The async view of an API object. */
export type Remote<T> = {
  [K in keyof T as T[K] extends AnyFunction ? K : never]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
};

interface Request {
  readonly rpc: 'call';
  readonly id: number;
  readonly method: string;
  readonly args: unknown[];
}

interface Response {
  readonly rpc: 'result';
  readonly id: number;
  readonly value?: unknown;
  readonly error?: { name: string; message: string; code?: string; data?: unknown };
}

/** Serves `api` on the endpoint. Returns a function that stops serving. */
export const expose = (api: object, endpoint: MessageEndpoint): (() => void) => {
  const listener = async (event: MessageEvent) => {
    const message = event.data as Request;
    if (message?.rpc !== 'call') return;
    const method = (api as Record<string, unknown>)[message.method];
    try {
      if (typeof method !== 'function') throw new Error(`Unknown method ${message.method}`);
      const value: unknown = await method.apply(api, message.args);
      endpoint.postMessage({ rpc: 'result', id: message.id, value } satisfies Response);
    } catch (error) {
      const failure = error as { name?: string; message?: string; code?: string; data?: unknown };
      endpoint.postMessage({
        rpc: 'result',
        id: message.id,
        error: {
          name: failure.name ?? 'Error',
          message: failure.message ?? String(error),
          ...(failure.code !== undefined && { code: failure.code }),
          ...(failure.data !== undefined && { data: failure.data }),
        },
      } satisfies Response);
    }
  };
  endpoint.addEventListener('message', listener);
  endpoint.start?.();
  return () => endpoint.removeEventListener('message', listener);
};

/**
 * Calls the API exposed on the other side of the endpoint. When the endpoint reports an error
 * (the worker crashed) every pending call fails with a `WorkerFailedError`, as does a call that
 * gets no answer within `timeoutMs` (default 2 minutes).
 */
export const wrap = <T extends object>(
  endpoint: MessageEndpoint,
  options: { timeoutMs?: number } = {},
): Remote<T> & { dispose(): void } => {
  let nextId = 1;
  const pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const failAll = (error: Error) => {
    for (const call of pending.values()) {
      clearTimeout(call.timer);
      call.reject(error);
    }
    pending.clear();
  };
  const onError = (event: Event) => {
    const detail = (event as ErrorEvent).message;
    failAll(new WorkerFailedError(`The code worker failed${detail ? `: ${detail}` : ''}`));
  };
  const listener = (event: MessageEvent) => {
    const message = event.data as Response;
    if (message?.rpc !== 'result') return;
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    clearTimeout(call.timer);
    if (message.error) {
      call.reject(Object.assign(new Error(message.error.message), message.error));
    } else {
      call.resolve(message.value);
    }
  };
  endpoint.addEventListener('message', listener);
  endpoint.addEventListener('error', onError);
  endpoint.addEventListener('messageerror', onError);
  endpoint.start?.();
  const timeoutMs = options.timeoutMs ?? 120_000;
  return new Proxy({} as Remote<T> & { dispose(): void }, {
    get: (_target, property) => {
      if (property === 'dispose') {
        return () => {
          endpoint.removeEventListener('message', listener);
          endpoint.removeEventListener('error', onError);
          endpoint.removeEventListener('messageerror', onError);
          failAll(new Error('Worker connection closed'));
        };
      }
      if (typeof property !== 'string' || property === 'then') return undefined;
      return (...args: unknown[]) =>
        new Promise((resolve, reject) => {
          const id = nextId++;
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new WorkerFailedError(`The code worker did not answer ${property} in time`));
          }, timeoutMs);
          pending.set(id, { resolve, reject, timer });
          endpoint.postMessage({ rpc: 'call', id, method: property, args } satisfies Request);
        });
    },
  });
};
