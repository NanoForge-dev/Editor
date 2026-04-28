import type { RequestEvent } from '@sveltejs/kit';

import { type Api, getApi } from '$lib/server/api';
import { FileSystem } from '$lib/server/file-system';

import type { Context } from '@utils-server/request-handler/context';

export class Handler<Body = any> {
  private _context: Context;
  private readonly _event: RequestEvent;
  private readonly _body: Body;

  private _apiCache: Api | undefined;
  private _cliCache: any | undefined;
  private _fsCache: FileSystem | undefined;
  private _loaderCache: any | undefined;
  private _gitCache: any | undefined;

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
    this._loaderCache = undefined;
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

  get cli(): any {
    if (!this._cliCache) this._cliCache = {};
    return this._cliCache;
  }

  get fs(): FileSystem {
    if (!this._fsCache) this._fsCache = new FileSystem(this._context);
    return this._fsCache;
  }

  get loader(): any {
    if (!this._loaderCache) this._loaderCache = {};
    return this._loaderCache;
  }

  get git(): any {
    if (!this._gitCache) this._gitCache = {};
    return this._gitCache;
  }
}
