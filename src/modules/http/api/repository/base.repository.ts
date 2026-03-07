import { type HttpClient, type RequestOptions } from '@utils/http';

export class BaseRepository {
  private readonly _client: HttpClient;

  constructor(client: HttpClient) {
    this._client = client;
  }

  protected get(path: string, options?: RequestOptions): Promise<Response> {
    return this._client.get(path, options);
  }

  protected post(path: string, body: object, options?: RequestOptions): Promise<Response> {
    return this._client.post(path, JSON.stringify(body), options);
  }

  protected put(path: string, body: object, options?: RequestOptions): Promise<Response> {
    return this._client.put(path, JSON.stringify(body), options);
  }

  protected patch(path: string, body: object, options?: RequestOptions): Promise<Response> {
    return this._client.patch(path, JSON.stringify(body), options);
  }

  protected delete(path: string, options?: RequestOptions): Promise<Response> {
    return this._client.delete(path, options);
  }
}
