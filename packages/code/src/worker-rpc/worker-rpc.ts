/**
 * Minimal typed RPC over `postMessage` (a web worker, a MessagePort): the other side's
 * methods become async functions. Errors are rethrown with their message and name.
 */
export interface MessageEndpoint {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  start?(): void;
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

/** Calls the API exposed on the other side of the endpoint. */
export const wrap = <T extends object>(
  endpoint: MessageEndpoint,
): Remote<T> & { dispose(): void } => {
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  const listener = (event: MessageEvent) => {
    const message = event.data as Response;
    if (message?.rpc !== 'result') return;
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) {
      call.reject(Object.assign(new Error(message.error.message), message.error));
    } else {
      call.resolve(message.value);
    }
  };
  endpoint.addEventListener('message', listener);
  endpoint.start?.();
  return new Proxy({} as Remote<T> & { dispose(): void }, {
    get: (_target, property) => {
      if (property === 'dispose') {
        return () => {
          endpoint.removeEventListener('message', listener);
          for (const call of pending.values()) call.reject(new Error('Worker connection closed'));
          pending.clear();
        };
      }
      if (typeof property !== 'string' || property === 'then') return undefined;
      return (...args: unknown[]) =>
        new Promise((resolve, reject) => {
          const id = nextId++;
          pending.set(id, { resolve, reject });
          endpoint.postMessage({ rpc: 'call', id, method: property, args } satisfies Request);
        });
    },
  });
};
