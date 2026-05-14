import { deserialize } from '$app/forms';

import type { HttpClient, RequestOptions } from '@utils/http';

export class BaseRepository {
  private readonly _client: HttpClient;

  constructor(client: HttpClient) {
    this._client = client;
  }

  protected run<R extends object = object, I extends object = object>(
    path: string,
    body?: I,
    options?: RequestOptions,
  ): Promise<R> {
    return this.runRequestBody(path, body, options);
  }

  private async runRequestBody<R, I>(path: string, body?: I, options?: RequestOptions): Promise<R> {
    const rawResult = await this._client.postFormData(
      path,
      this._parseBodyToFormData(body),
      options,
    );
    const result = deserialize(await rawResult.text());

    if (result.type === 'redirect')
      throw new Error(`Redirect (${result.status}) - ${result.location}`);
    if (result.type === 'error') throw new Error(`Error (${result.status}) - ${result.error}`);
    if (result.type === 'failure') throw new Error(`Failure (${result.status}) - ${result.data}`);

    return result.data as R;
  }

  private _parseBodyToFormData(body?: any): FormData {
    const formData = new FormData();
    if (body) {
      for (const [key, baseValue] of Object.entries(body)) {
        let value: Blob | string;
        if (baseValue instanceof File) value = baseValue;
        else value = JSON.stringify(baseValue);
        formData.append(key, value);
      }
    }
    return formData;
  }
}
