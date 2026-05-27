import { Exception } from '@utils/exception';

import type { Context } from './context';
import type { RequestHandlerOptions } from './types';

const DEFAULT_OPTIONS: RequestHandlerOptions = {
  onlineOnly: false,
  offlineOnly: false,
  projectOptional: false,
};

const assertProject = (context: Context, options: RequestHandlerOptions): void | never => {
  if (options.projectOptional) return;

  if (!context.session) throw new Exception('Bad Request', 'No session', 400);
  if (!context.project) throw new Exception('Bad Request', 'Request required a project', 400);

  if (context.online && !context.project.gateway)
    throw new Exception('Internal Server Error', "Project don't have gateway on online mode", 500);
};

const assertMode = (context: Context, options: RequestHandlerOptions): void | never => {
  if (options.onlineOnly && !context.online)
    throw new Exception('Method Not Allowed', 'This action is not available offline', 405);
  if (options.offlineOnly && context.online)
    throw new Exception('Method Not Allowed', 'This action is not available online', 405);
};

export const assertRequest = (
  context: Context,
  rawOptions?: RequestHandlerOptions,
): void | never => {
  const options = { ...DEFAULT_OPTIONS, ...rawOptions };

  assertMode(context, options);
  assertProject(context, options);
};
