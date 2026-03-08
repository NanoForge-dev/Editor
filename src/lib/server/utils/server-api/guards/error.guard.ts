import { json } from '@sveltejs/kit';
import { STATUS_CODES } from 'node:http';

export const errorGuard = async (callback: () => Promise<Response>): Promise<Response> => {
  try {
    return await callback();
  } catch (error: any) {
    const data:
      | {
          statusCode: number;
          path: string;
          error: {
            message: string | string[];
            timestamp: string;
            cause?: {
              message: string;
            };
          };
        }
      | undefined = error?.cause;

    const statusCode = data?.statusCode ?? 500;

    return json(
      {
        error: STATUS_CODES[statusCode] || 'Unknown error',
        message: data?.error?.message || 'Unknown error',
        cause: data?.error?.cause?.message || undefined,
      },
      { status: statusCode },
    );
  }
};
