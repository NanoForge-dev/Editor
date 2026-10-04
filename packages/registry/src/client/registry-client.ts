import semver from 'semver';

import { type RegistryItem, SearchQuery, type SearchResult } from '../item/item.schema';
import { RegistryError } from '../registry/registry.exception';
import type { Registry } from '../registry/registry.type';
import { fromPackument, fromSearchObject } from '../wire/packument';
import { Packument, ROUTES, WireSearch } from '../wire/wire.schema';

export interface RegistryClientOptions {
  /** Base URL of the API holding `/registry/…`. */
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
  /** Headers of every request (reading needs none; a registry key to publish). */
  readonly headers?: () => Record<string, string>;
}

/** The registry over HTTP (the contract of `docs/api/registry.md`). */
export class RegistryClient implements Registry {
  constructor(private readonly _options: RegistryClientOptions) {}

  async search(query: SearchQuery = {}): Promise<SearchResult> {
    const { type, q, page, limit } = SearchQuery.parse(query);
    const params = new URLSearchParams({
      text: q,
      from: String((page - 1) * limit),
      size: String(limit),
    });
    if (type) params.set('type', type);
    const response = await this._request(`${ROUTES.search}?${params}`);
    const found = this._parse(WireSearch, await this._json(response));
    return { items: found.objects.map(fromSearchObject), total: found.total };
  }

  async get(name: string): Promise<RegistryItem> {
    return fromPackument(await this._packument(name), semver.rcompare);
  }

  async download(name: string, version: string): Promise<Uint8Array> {
    const found = (await this._packument(name)).versions[version];
    if (!found) throw new RegistryError('NOT_FOUND', `${name}@${version} was not found`);
    const response = await this._request(found.dist.file, `${name}@${version}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  private async _packument(name: string): Promise<Packument> {
    const response = await this._request(ROUTES.item(name), name);
    return this._parse(Packument, await this._json(response));
  }

  private async _request(path: string, subject?: string): Promise<Response> {
    let response: Response;
    try {
      response = await (this._options.fetch ?? fetch)(
        new URL(path, this._options.baseUrl).toString(),
        { headers: this._options.headers?.() ?? {} },
      );
    } catch (error) {
      throw new RegistryError(
        'UNAVAILABLE',
        `The registry cannot be reached: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (response.status === 404) {
      throw subject
        ? new RegistryError('NOT_FOUND', `${subject} was not found`)
        : new RegistryError('UNAVAILABLE', 'This registry does not answer searches yet');
    }
    if (!response.ok)
      throw new RegistryError('UNAVAILABLE', `The registry answered ${response.status}`);
    return response;
  }

  private async _json(response: Response): Promise<unknown> {
    try {
      return (await response.json()) as unknown;
    } catch {
      return undefined;
    }
  }

  private _parse<T>(
    schema: { safeParse(value: unknown): { success: boolean; data?: T } },
    value: unknown,
  ): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
      throw new RegistryError(
        'UNAVAILABLE',
        'The registry sent an answer this version cannot read',
      );
    return parsed.data as T;
  }
}
