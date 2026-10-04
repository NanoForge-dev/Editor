import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { sha256 } from '../../src';

/**
 * What the editor and the CLI need from the registry (docs/api/registry.md), as scenarios that
 * only speak HTTP and only read. They run against the reference implementation
 * (`serveRegistry`) in this package's tests, and against a real registry when
 * `CONTRACT_REGISTRY_URL` is set (see `registry.contract.test.ts`).
 */
export interface RegistryTarget {
  readonly baseUrl: string;
  readonly fetch: (url: string) => Promise<Response>;
  /** A published item to read: `@scope/name`. */
  readonly item: string;
}

export const registryContract = (target: () => RegistryTarget): void => {
  const get = (path: string) => {
    const { baseUrl, fetch } = target();
    return fetch(new URL(path, baseUrl).toString());
  };
  const json = async (path: string) => {
    const response = await get(path);
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
  const VERSION = {
    name: expect.any(String) as string,
    version: expect.stringMatching(/^\d+\.\d+\.\d+/) as string,
    type: expect.stringMatching(/^(plugin|package)$/) as string,
    dist: {
      file: expect.any(String) as string,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
    },
  };

  describe('reading needs no key and no user', () => {
    it('describes an item: its versions, where their archives are, the latest one', async () => {
      const { item } = target();
      const { status, body } = await json(`/registry/${item}`);
      expect(status).toBe(200);
      expect(body).toMatchObject({
        name: item,
        type: expect.stringMatching(/^(plugin|package)$/) as string,
        'dist-tags': { latest: expect.any(String) as string },
        versions: expect.any(Object) as object,
      });
      const versions = body.versions as Record<string, unknown>;
      const latest = (body['dist-tags'] as { latest: string }).latest;
      expect(versions[latest]).toMatchObject({ ...VERSION, name: item, version: latest });
      for (const [version, entry] of Object.entries(versions))
        expect(entry).toMatchObject({ ...VERSION, version });
      expect((await json(`/registry/${item.replace('/', '%2F')}`)).status).toBe(200);
    });

    it('answers 404 for an item that does not exist', async () => {
      expect((await get('/registry/@contract-test/no-such-item')).status).toBe(404);
    });

    it('serves the archive: a zip with the hash the item gave and its manifest at the root', async () => {
      const { item, baseUrl, fetch } = target();
      const { body } = await json(`/registry/${item}`);
      const latest = (body['dist-tags'] as { latest: string }).latest;
      const { dist } = (
        body.versions as Record<string, { dist: { file: string; sha256: string } }>
      )[latest]!;
      const response = await fetch(new URL(dist.file, baseUrl).toString());
      expect(response.status).toBe(200);
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(sha256(bytes)).toBe(dist.sha256);
      const manifest = unzipSync(bytes)['nanoforge.manifest.json'];
      expect(manifest).toBeDefined();
      expect(JSON.parse(strFromU8(manifest!))).toMatchObject({ name: item, version: latest });
    });

    it('searches by text and type, in pages', async () => {
      const { item } = target();
      const short = item.split('/')[1]!;
      const { status, body } = await json(
        `/registry/-/v1/search?text=${encodeURIComponent(short)}&size=50`,
      );
      expect(status).toBe(200);
      expect(body).toMatchObject({ total: expect.any(Number) as number });
      const objects = body.objects as { package: { name: string; type: string } }[];
      const found = objects.find((entry) => entry.package.name === item);
      expect(found).toMatchObject({
        package: {
          name: item,
          version: expect.any(String) as string,
          type: expect.stringMatching(/^(plugin|package)$/) as string,
        },
      });

      const other = found!.package.type === 'plugin' ? 'package' : 'plugin';
      const filtered = await json(
        `/registry/-/v1/search?text=${encodeURIComponent(short)}&type=${other}&size=50`,
      );
      expect(
        (filtered.body.objects as { package: { type: string } }[]).every(
          (entry) => entry.package.type === other,
        ),
      ).toBe(true);

      const page = await json('/registry/-/v1/search?text=&size=1&from=0');
      expect((page.body.objects as unknown[]).length).toBeLessThanOrEqual(1);
      const none = await json('/registry/-/v1/search?text=zz-no-such-thing-zz');
      expect(none.body).toMatchObject({ objects: [], total: 0 });
    });
  });
};
