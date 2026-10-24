import { RegistryError } from '../registry/registry.exception';
import type { Registry } from '../registry/registry.type';
import { toPackument, toSearchObject } from '../wire/packument';

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * The registry's read routes over any registry, as a `fetch` handler: a stand-in server for
 * tests, and the reference implementation of the contract (`docs/api/registry.md`).
 */
export const serveRegistry =
  (registry: Registry) =>
  async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const path = decodeURIComponent(url.pathname);
    try {
      if (path === '/registry/-/v1/search') {
        const type = url.searchParams.get('type');
        const size = Math.min(Math.max(Number(url.searchParams.get('size') ?? 30) || 30, 1), 100);
        const from = Math.max(Number(url.searchParams.get('from') ?? 0) || 0, 0);
        const found = await registry.search({
          ...(type === 'plugin' || type === 'package' ? { type } : {}),
          q: url.searchParams.get('text') ?? '',
          page: Math.floor(from / size) + 1,
          limit: size,
        });
        return json(200, { objects: found.items.map(toSearchObject), total: found.total });
      }
      const archive = /^\/registry\/(@[^/]+\/([^/]+))\/-\/([^/]+)\.zip$/.exec(path);
      if (archive) {
        const [, name, short, file] = archive;
        if (!file!.startsWith(`${short}-`)) return json(404, { error: 'No such file' });
        const bytes = await registry.download(name!, file!.slice(short!.length + 1));
        return new Response(bytes as BodyInit, {
          status: 200,
          headers: { 'content-type': 'application/zip' },
        });
      }
      const item = /^\/registry\/(@[^/]+\/[^/]+)$/.exec(path);
      if (item) return json(200, toPackument(await registry.get(item[1]!)));
      return json(404, { error: 'No such route' });
    } catch (error) {
      if (error instanceof RegistryError && error.code === 'NOT_FOUND')
        return json(404, { error: error.message });
      return json(500, { error: error instanceof Error ? error.message : String(error) });
    }
  };
