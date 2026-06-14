import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Exception } from '@utils/exception';
import type { ClassType } from '@utils/types';

export const parseFormDataBody = <Body extends object = any>(
  rawBody: FormData,
  c: ClassType<Body> | undefined,
): Promise<Body> => {
  const baseBody = Object.fromEntries(
    Array.from(rawBody.entries()).map(([key, value]) => [key, JSON.parse(value)]),
  );
  return parseBody(baseBody, c);
};

export const parseBody = async <Body extends object = any>(
  baseBody: any,
  c: ClassType<Body> | undefined,
): Promise<Body> => {
  if (!c) return baseBody as Body;
  const data = plainToInstance(c, baseBody, {
    excludeExtraneousValues: true,
  });
  const errors = await validate(data);
  if (errors.length > 0)
    throw new Exception(
      'Bad Request',
      `Invalid body :\n${errors.toString().replace(/,/g, '\n')}`,
      400,
    );
  return baseBody as Body;
};
