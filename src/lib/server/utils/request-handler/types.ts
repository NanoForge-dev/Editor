import type { ClassType, MaybePromise } from '@utils/types';

import type { Handler } from './handler';

export type Callback<Body = any> = (opts: Handler<Body>) => MaybePromise<object | never>;

export interface RequestHandlerOptions<Body = any> {
  onlineOnly?: boolean;
  offlineOnly?: boolean;
  projectOptional?: boolean;
  body?: ClassType<Body>;
}
