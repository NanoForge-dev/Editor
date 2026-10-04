import { RpcError } from '@nanoforge-dev/editor-rpc';

import type { RequestContext } from '../session/auth';

export const requireUser = (context: RequestContext) => {
  const user = context.session.user;
  if (!user) throw new RpcError('UNAUTHORIZED', 'Not signed in');
  return user;
};
