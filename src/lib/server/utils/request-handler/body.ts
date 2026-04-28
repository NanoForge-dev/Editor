import type { ClassType } from '@utils/types';

export const parseBody = <Body = any>(baseBody: any, c: ClassType<Body> | undefined): Body => {
  // @todo add class validation and class transformation
  void c;
  return baseBody as Body;
};
