import { Exception } from '@utils/exception';
import type { MaybePromise } from '@utils/types';

import { toastError } from '@utils-client/toasts';

export const handleError = (error: unknown, context?: string) => {
  const message = `Failed to ${context ?? 'execute'}`;
  if (error instanceof Exception) {
    console.error(`${message} (${error.error} - ${error.status}): ${error.message}`);
    toastError(message, error.message);
    return;
  }
  console.error(`${message}: ${error}`);
  toastError(message, `${error}`);
};

export const runSafe = async <T = undefined>(
  context: string,
  cb: () => Promise<T>,
  fallback?: () => MaybePromise<void>,
): Promise<T | null> => {
  try {
    return await cb();
  } catch (error) {
    handleError(error, context);
  }
  fallback?.();
  return null;
};
