import { type Action, type ActionFailure, fail } from '@sveltejs/kit';

import { Exception } from '../exception';
import { parseBody } from './body';
import { getContext } from './context';
import { Handler } from './handler';
import { assertRequest } from './request.policy';
import type { Callback, RequestHandlerOptions } from './types';

const handleError = (e: unknown): ActionFailure<{ error: string; message: unknown }> => {
  if (e instanceof Exception) {
    return fail(e.status, { error: e.error, message: e.message });
  }
  return fail(500, { error: 'Internal Server Error', message: e });
};

export const useRequestHandler = <Body = any>(
  callback: Callback<Body>,
  options?: RequestHandlerOptions<Body>,
): Action => {
  return async (event) => {
    try {
      const context = await getContext(event);

      const body = parseBody<Body>(await event.request.formData(), options?.body);

      assertRequest(context, options);

      const handler = new Handler<Body>(context, event, body);

      return await callback(handler);
    } catch (e) {
      return handleError(e);
    }
  };
};
