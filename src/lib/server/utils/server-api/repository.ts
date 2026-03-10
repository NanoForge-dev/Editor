import type { HttpClient, RequestOptions } from '@utils/http';

export class Repository {
  private readonly _client: HttpClient;

  constructor(client: HttpClient) {
    this._client = client;
  }

  get<R extends object = object>(path: string, options?: RequestOptions): Promise<R> {
    return this.runRequest('get', path, options);
  }

  post<R extends object = object, I extends object = object>(
    path: string,
    body?: I,
    options?: RequestOptions,
  ): Promise<R> {
    return this.runRequestBody('post', path, body, options);
  }

  put<R extends object = object, I extends object = object>(
    path: string,
    body?: I,
    options?: RequestOptions,
  ): Promise<R> {
    return this.runRequestBody('put', path, body, options);
  }

  patch<R extends object = object, I extends object = object>(
    path: string,
    body?: I,
    options?: RequestOptions,
  ): Promise<R> {
    return this.runRequestBody('patch', path, body, options);
  }

  delete<R extends object = object>(path: string, options?: RequestOptions): Promise<R> {
    return this.runRequest('delete', path, options);
  }

  private async runRequest<R>(
    request: 'get' | 'delete',
    path: string,
    options?: RequestOptions,
  ): Promise<R> {
    const res = await this._client[request](path, options);
    if (!res.ok)
      throw new Error(`Request failed with status code ${res.status}`, {
        cause: res,
      });
    return (await res.json()) as R;
  }

  private async runRequestBody<R, I>(
    request: 'post' | 'put' | 'patch',
    path: string,
    body?: I,
    options?: RequestOptions,
  ): Promise<R> {
    const res = await this._client[request](
      path,
      body === undefined ? undefined : JSON.stringify(body),
      options,
    );
    const data = (await res.json()) as R;
    if (!res.ok)
      throw new Error(`Request failed with status code ${res.status}`, {
        cause: data,
      });
    return data;
  }
}
