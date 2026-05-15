import type { RequestEvent } from '@sveltejs/kit';

import { type Api, getApi } from '$lib/server/api';
import { Cli } from '$lib/server/cli';
import { FileSystem } from '$lib/server/file-system';
import { Git } from '$lib/server/git';
import { ProjectManager } from '$lib/server/project';

import type { Context } from '@utils-server/request-handler/context';

export class Handler<Body = any> {
  private _context: Context;
  private readonly _event: RequestEvent;
  private readonly _body: Body;

  private _apiCache: Api | undefined;
  private _cliCache: Cli | undefined;
  private _fsCache: FileSystem | undefined;
  private _gitCache: Git | undefined;
  private _projectCache: ProjectManager | undefined;

  constructor(context: Context, event: RequestEvent, body: Body) {
    this._context = context;
    this._event = event;
    this._body = body;
  }

  get context(): Context {
    return this._context;
  }

  set context(context: Context) {
    this._context = context;

    this._apiCache = undefined;
    this._cliCache = undefined;
    this._fsCache = undefined;
    this._gitCache = undefined;
  }

  get event(): RequestEvent {
    return this._event;
  }

  get body(): Body {
    return this._body;
  }

  get api(): Api {
    if (!this._apiCache) this._apiCache = getApi(this._context, this._event.cookies);
    return this._apiCache;
  }

  get cli(): Cli {
    if (!this._cliCache) this._cliCache = new Cli(this._context);
    return this._cliCache;
  }

  get fs(): FileSystem {
    if (!this._fsCache) this._fsCache = new FileSystem(this._context);
    return this._fsCache;
  }

  get git(): Git {
    if (!this._gitCache) this._gitCache = new Git();
    return this._gitCache;
  }

  get project(): ProjectManager {
    if (!this._projectCache) this._projectCache = new ProjectManager(this._context);
    return this._projectCache;
  }
}
