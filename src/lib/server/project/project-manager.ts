import { ProjectHandler } from '$lib/server/project/project-handler';

import type { Context } from '@utils-server/request-handler';

export class ProjectManager {
  private readonly _context: Context;

  private _client: ProjectHandler | undefined;
  private _server: ProjectHandler | undefined;

  constructor(context: Context) {
    this._context = context;
  }

  /**
   * Get the client project handler
   * @beta The separation between client and server projects is not the final goal of the project manager.
   */
  get client(): ProjectHandler {
    if (!this._client) this._client = new ProjectHandler(this._context, 'client');
    return this._client;
  }

  /**
   * Get the server project handler
   * @beta The separation between client and server projects is not the final goal of the project manager.
   */
  get server(): ProjectHandler {
    if (!this._server) this._server = new ProjectHandler(this._context, 'server');
    return this._server;
  }
}
