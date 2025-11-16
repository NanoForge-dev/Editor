export type RequestOptions = Omit<RequestInit, 'body' | 'method'>;

export interface MiddlewareParams {
  path: string;
  fullPath: string;
  options: RequestOptions;
}

export type MiddlewareNext = (params?: MiddlewareParams) => Promise<Response>;

export type Middleware = (
  params: MiddlewareParams,
  next: MiddlewareNext,
) => Promise<Response | undefined> | undefined;

type BaseRequest = (path: string, options: RequestOptions) => Promise<Response>;

export class HttpClient {
  private readonly _baseUrl: string;
  private readonly _baseOptions: RequestOptions;
  private readonly _middlewares: Middleware[];

  constructor(baseUrl: string) {
    this._baseUrl = baseUrl;
    this._baseOptions = {};
    this._middlewares = [];
  }

  get(path: string, options?: RequestOptions): Promise<Response> {
    return this._applyMiddlewares(path, options, (newPath, newOptions) => {
      return fetch(newPath, {
        ...newOptions,
        method: 'GET',
      });
    });
  }

  post(path: string, body?: any, options?: RequestOptions): Promise<Response> {
    return this._applyMiddlewares(path, options, (newPath, newOptions) => {
      return fetch(newPath, {
        ...newOptions,
        method: 'POST',
        body: body,
      });
    });
  }

  put(path: string, body?: any, options?: RequestOptions): Promise<Response> {
    return this._applyMiddlewares(path, options, (newPath, newOptions) => {
      return fetch(newPath, {
        ...newOptions,
        method: 'PUT',
        body: body,
      });
    });
  }

  patch(path: string, body?: any, options?: RequestOptions): Promise<Response> {
    return this._applyMiddlewares(path, options, (newPath, newOptions) => {
      return fetch(newPath, {
        ...newOptions,
        method: 'PATCH',
        body: body,
      });
    });
  }

  delete(path: string, options?: RequestOptions): Promise<Response> {
    return this._applyMiddlewares(path, options, (newPath, newOptions) => {
      return fetch(newPath, {
        ...newOptions,
        method: 'DELETE',
      });
    });
  }

  useMiddlewares(...middlewares: Middleware[]): HttpClient {
    for (const middleware of middlewares) this._middlewares.push(middleware);
    return this;
  }

  private _applyMiddlewares(
    path: string,
    options: RequestOptions | undefined,
    callback: BaseRequest,
  ): Promise<Response> {
    const baseParams = {
      path,
      fullPath: this._getUrl(path),
      options: {
        ...this._baseOptions,
        ...options,
      },
    };
    const middlewares = this._middlewares.slice();
    let response: Response;

    const execution = async (params?: MiddlewareParams): Promise<Response> => {
      if (!params) params = baseParams;

      const middleware = middlewares.shift();

      if (!middleware) response = (await callback(params.fullPath, params.options)) as Response;
      else response = (await middleware(params, execution)) ?? response;

      return response;
    };

    return execution(baseParams);
  }

  private _getUrl(path: string): string {
    return `${this._baseUrl}${path}`;
  }
}
