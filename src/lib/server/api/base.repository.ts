import type { HttpClient, RequestOptions } from '@utils/http';

type FullRequestOptions = RequestOptions & { offline?: boolean };

export class BaseRepository {
  private readonly _client: HttpClient;
  private readonly _online: boolean;

  constructor(client: HttpClient, online: boolean = true) {
    this._client = client;
    this._online = online;
  }

  protected get<R extends object = object>(path: string, options?: FullRequestOptions): Promise<R> {
    return this.runRequest('get', path, options);
  }

  protected post<R extends object = object, I extends object = object>(
    path: string,
    body?: I,
    options?: FullRequestOptions,
  ): Promise<R> {
    return this.runRequestBody('post', path, body, options);
  }

  protected put<R extends object = object, I extends object = object>(
    path: string,
    body?: I,
    options?: FullRequestOptions,
  ): Promise<R> {
    return this.runRequestBody('put', path, body, options);
  }

  protected patch<R extends object = object, I extends object = object>(
    path: string,
    body?: I,
    options?: FullRequestOptions,
  ): Promise<R> {
    return this.runRequestBody('patch', path, body, options);
  }

  protected delete<R extends object = object>(
    path: string,
    options?: FullRequestOptions,
  ): Promise<R> {
    return this.runRequest('delete', path, options);
  }

  private assertOnline() {
    if (!this._online) throw new Error('This route is only available in online mode');
  }

  private async runRequest<R>(
    request: 'get' | 'delete',
    path: string,
    options?: FullRequestOptions,
  ): Promise<R> {
    if (!options?.offline) this.assertOnline();

    const res = await this._client[request](path, options);
    if (!res.ok)
      throw new Error(`Request failed with status code ${res.status}`, {
        cause: await res.json(),
      });
    return (await res.json()) as R;
  }

  private async runRequestBody<R, I>(
    request: 'post' | 'put' | 'patch',
    path: string,
    body?: I,
    options?: FullRequestOptions,
  ): Promise<R> {
    if (!options?.offline) this.assertOnline();

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
