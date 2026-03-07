import type { MiddlewareNext, MiddlewareParams } from '@utils/http';
import { toast } from 'svelte-sonner';

export const LoggerMiddleware = async (params: MiddlewareParams, next: MiddlewareNext) => {
  const res = await next(params);
  if (res.ok) return res;
  const content = await res.json();
  const message = content?.error?.message
    ? Array.isArray(content.error.message)
      ? content.error.message.map((err: string) => `- ${err}`).join('\n')
      : content.error.message
    : 'Unknown error';
  toast.error(`An error occured :\n${message}`);

  throw new Error(message, {
    cause: res,
  });
};
