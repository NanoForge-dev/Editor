import type { Contract, MethodMap, StreamMap } from './contract.type';

export const NAMESPACE_PATTERN =
  /^[a-z][\w-]*(\.[a-z][\w-]*)*(\.@[a-z0-9][\w-]*\/[a-z0-9][\w-]*)?$/;

/** Declares a typed RPC contract, shared by the client and the server implementation. */
export const defineContract = <N extends string, M extends MethodMap, S extends StreamMap = {}>(
  namespace: N,
  definition: { methods: M; streams?: S },
): Contract<N, M, S> => {
  if (!NAMESPACE_PATTERN.test(namespace)) throw new Error(`Invalid RPC namespace "${namespace}"`);
  return Object.freeze({
    namespace,
    methods: definition.methods,
    streams: (definition.streams ?? {}) as S,
  });
};
