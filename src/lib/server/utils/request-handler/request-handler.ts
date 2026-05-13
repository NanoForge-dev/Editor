import type { RequestEvent } from '@sveltejs/kit';

import type { MaybePromise } from '@utils/types';

import { Exception } from '../exception';
import { parseBody } from './body';
import { getContext } from './context';
import { Handler } from './handler';
import { assertRequest } from './request.policy';
import type { RequestHandlerOptions } from './types';

type Callback<Body = any> = (opts: Handler<Body>) => MaybePromise<Response | never>;

const handleError = (e: unknown): Response => {
  if (e instanceof Exception) {
    return Response.json({ error: e.error, message: e.message }, { status: e.status });
  }
  return Response.json({ error: 'Internal Server Error', message: e }, { status: 500 });
};

export const useRequestHandler = (
  callback: Callback<Body>,
  options?: RequestHandlerOptions<Body>,
): ((event: RequestEvent) => MaybePromise<Response>) => {
  return async (event: RequestEvent) => {
    try {
      const context = await getContext(event);

      const body = parseBody<Body>(await event.request.json(), options?.body);

      assertRequest(context, options);

      const handler = new Handler<Body>(context, event, body);

      return await callback(handler);
    } catch (e) {
      return handleError(e);
    }
  };
};
