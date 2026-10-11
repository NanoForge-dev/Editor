import semver from 'semver';

import { MAX_ARCHIVE_BYTES } from '../archive/archive';
import { type RegistryItem, SearchQuery, type SearchResult } from '../item/item.schema';
import { RegistryError } from '../registry/registry.exception';
import type { Registry } from '../registry/registry.type';
import { fromPackument, fromSearchObject } from '../wire/packument';
import { Packument, ROUTES, WireSearch } from '../wire/wire.schema';

const ABBREVIATED = 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8';

export interface RegistryClientOptions {
  /** Base URL of the API holding `/registry/…`. */
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
  /** Headers of every request (reading needs none; a registry key to publish). */
  readonly headers?: () => Record<string, string>;
  /** How long a request may take (default 60 s). */
  readonly timeoutMs?: number;
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
    const found = (await this._packument(name, true)).versions[version];
    if (!found) throw new RegistryError('NOT_FOUND', `${name}@${version} was not found`);
    const subject = `${name}@${version}`;
    const response = await this._request(found.dist.tarball, subject);
    const limit = Math.min(found.dist.size ?? MAX_ARCHIVE_BYTES, MAX_ARCHIVE_BYTES);
    const bytes = await readLimited(response, limit, subject);
    if (found.dist.size !== undefined && bytes.length !== found.dist.size)
      throw new RegistryError('INTEGRITY', `${subject} does not have the size the registry says`);
    return bytes;
  }

  /**
   * The document of an item. `abbreviated` asks for what installing needs (npm's
   * `application/vnd.npm.install-v1+json`): versions without their contents nor the readme.
   */
  private async _packument(name: string, abbreviated = false): Promise<Packument> {
    const response = await this._request(
      ROUTES.item(name),
      name,
      abbreviated ? { accept: ABBREVIATED } : {},
    );
    return this._parse(Packument, await this._json(response));
  }

  /**
   * A request to the registry, or to where it keeps an archive (`dist.tarball` may be anywhere):
   * http(s) only, and the registry's headers only go to the registry's own origin.
   */
  private async _request(
    path: string,
    subject?: string,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    const base = new URL(this._options.baseUrl);
    const url = new URL(path, base);
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
      throw new RegistryError(
        'INVALID',
        `The registry gave an address that is not http(s): ${url.protocol}`,
      );
    let response: Response;
    try {
      response = await (this._options.fetch ?? fetch)(url.toString(), {
        headers: {
          ...headers,
          ...(url.origin === base.origin ? this._options.headers?.() : {}),
        },
        signal: AbortSignal.timeout(this._options.timeoutMs ?? 60_000),
      });
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

/** The body of a response, stopped as soon as it passes `limit` bytes. */
const readLimited = async (
  response: Response,
  limit: number,
  subject: string,
): Promise<Uint8Array> => {
  const declared = Number(response.headers.get('content-length') ?? NaN);
  const tooLarge = () => new RegistryError('INVALID', `${subject} is larger than allowed`);
  if (declared > limit) throw tooLarge();
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch (error) {
      throw new RegistryError(
        'UNAVAILABLE',
        `The download of ${subject} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (chunk.done) break;
    total += chunk.value.length;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge();
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
};
