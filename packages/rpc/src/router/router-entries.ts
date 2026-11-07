import { z } from 'zod';

import type { MethodDefinition, StreamDefinition } from '../contract/contract.type';
import { RpcError } from '../error/rpc.exception';
import type { HandlerContext, StreamCleanup, StreamSink } from './router.type';

export interface MethodEntry<Ctx> {
  definition: MethodDefinition;
  handler: (input: unknown, context: HandlerContext<Ctx>) => unknown;
}

export interface StreamEntry<Ctx> {
  definition: StreamDefinition;
  handler: (
    params: unknown,
    context: HandlerContext<Ctx>,
    sink: StreamSink<unknown>,
  ) => StreamCleanup | Promise<StreamCleanup>;
}

export const toRpcError = (error: unknown): RpcError => {
  if (error instanceof RpcError) return error;
  if (error instanceof z.ZodError) {
    return new RpcError('BAD_REQUEST', 'Invalid input', z.flattenError(error));
  }
  return new RpcError('INTERNAL', 'Internal error');
};
