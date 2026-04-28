import type { ClassType } from '@utils/types';

export const parseBody = <Body = any>(baseBody: any, c: ClassType<Body> | undefined): Body => {
  void c;
  return baseBody as Body;
};
