import type { ClassType } from '@utils/types';

export const parseBody = <Body = any>(rawBody: FormData, c: ClassType<Body> | undefined): Body => {
  const baseBody = Object.fromEntries(
    Array.from(rawBody.entries()).map(([key, value]) => [key, JSON.parse(value)]),
  );
  // @todo add class validation and class transformation
  void c;
  return baseBody as Body;
};
