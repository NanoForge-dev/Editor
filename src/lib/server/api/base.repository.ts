import type { HttpClient, RequestOptions } from '@utils/http';

export class BaseRepository {
  private readonly _client: HttpClient;

  constructor(client: HttpClient) {
    this._client = client;
  }

  protected get<R extends object = object>(path: string, options?: RequestOptions): Promise<R> {
    return this.runRequest('get', path, options);
  }

  protected post<R extends object = object, I extends object = object>(
    path: string,
    body?: I,
    options?: RequestOptions,
  ): Promise<R> {
    return this.runRequestBody('post', path, body, options);
  }

  protected put<R extends object = object, I extends object = object>(
    path: string,
    body?: I,
    options?: RequestOptions,
  ): Promise<R> {
    return this.runRequestBody('put', path, body, options);
  }

  protected patch<R extends object = object, I extends object = object>(
    path: string,
    body?: I,
    options?: RequestOptions,
  ): Promise<R> {
    return this.runRequestBody('patch', path, body, options);
  }

  protected delete<R extends object = object>(path: string, options?: RequestOptions): Promise<R> {
    return this.runRequest('delete', path, options);
  }

  private async runRequest<R>(
    request: 'get' | 'delete',
    path: string,
    options?: RequestOptions,
  ): Promise<R> {
    return (await this._client[request](path, options)).content as R;
  }

  private async runRequestBody<R, I>(
    request: 'post' | 'put' | 'patch',
    path: string,
    body?: I,
    options?: RequestOptions,
  ): Promise<R> {
    return (
      await this._client[request](
        path,
        body === undefined ? undefined : JSON.stringify(body),
        options,
      )
    ).content as R;
  }
}
