import { type RequestEvent } from '@sveltejs/kit';

import { type Api } from '$lib/server/api';
import { type FileSystem } from '$lib/server/file-system';

import type { ClassType, MaybePromise } from '@utils/types';

import type { Context } from './context';
import { type Handler } from './handler';

export interface CallbackOptions<Body = any> {
  event: RequestEvent;
  body: Body;
  context: Context;
  api: (context?: Context) => Api;
  cli: (context?: Context) => void;
  fs: (context?: Context) => FileSystem;
  loader: (context?: Context) => void;
}

export type Callback<Body = any> = (opts: Handler<Body>) => MaybePromise<object | never>;

export interface RequestHandlerOptions<Body = any> {
  onlineOnly?: boolean;
  offlineOnly?: boolean;
  projectOptional?: boolean;
  body?: ClassType<Body>;
}
