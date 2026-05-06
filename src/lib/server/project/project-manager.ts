import { ProjectHandler } from '$lib/server/project/project-handler';

import type { Context } from '@utils-server/request-handler';

export class ProjectManager {
  private readonly _context: Context;

  private _client: ProjectHandler | undefined;
  private _server: ProjectHandler | undefined;

  constructor(context: Context) {
    this._context = context;
  }

  get client(): ProjectHandler {
    if (!this._client) this._client = new ProjectHandler(this._context, 'client');
    return this._client;
  }

  get server(): ProjectHandler {
    if (!this._server) this._server = new ProjectHandler(this._context, 'server');
    return this._server;
  }
}
