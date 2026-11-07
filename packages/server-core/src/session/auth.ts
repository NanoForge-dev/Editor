import { type CallInfo, RpcError } from '@nanoforge-dev/editor-rpc';

import type { Session } from './session-store';

export interface RequestContext {
  readonly session: Session;
  /** `Set-Cookie` values to add to the HTTP response (ignored over WebSocket). */
  readonly responseCookies: string[];
}

/** RPC guard: every non public method needs a signed-in user. */
export const authorize = (context: RequestContext, call: CallInfo): void => {
  if (call.public) return;
  if (!context.session.user) {
    throw new RpcError('UNAUTHORIZED', 'Sign in on the NanoForge website to use the editor');
  }
};
