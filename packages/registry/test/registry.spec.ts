import { zipSync } from 'fflate';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DirectoryRegistry,
  ItemVersion,
  LOCK_FILE,
  PACKAGES_FILE,
  ProjectPackages,
  type Registry,
  RegistryClient,
  RegistryError,
  installItem,
  pickVersion,
  serveRegistry,
  sha256,
  withPathsEntry,
  withoutPathsEntry,
} from '../src';

let workspace: string;
let registryDir: string;
let registry: DirectoryRegistry;

/** Publishes a version in the folder registry. */
const publish = (
  name: string,
  version: string,
  options: {
    type?: 'package' | 'plugin';
    dependencies?: Record<string, string>;
    engines?: Record<string, string>;
    description?: string;
    files?: Record<string, string>;
    /** More fields of the manifest. */
    manifest?: Record<string, unknown>;
  } = {},
) => {
  const folder = join(registryDir, name, version);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, 'nanoforge.manifest.json'),
    JSON.stringify({
      type: options.type ?? 'package',
      name,
      version,
      description: options.description ?? `${name} for tests`,
      ...(options.dependencies && { dependencies: options.dependencies }),
      ...(options.engines && { engines: options.engines }),
      ...options.manifest,
    }),
  );
  for (const [path, text] of Object.entries(options.files ?? { 'index.ts': `// ${version}\n` })) {
    mkdirSync(join(folder, path, '..'), { recursive: true });
    writeFileSync(join(folder, path), text);
  }
};

const project = (name: string, tsconfig?: string) => {
  const root = join(workspace, name);
  mkdirSync(root, { recursive: true });
  if (tsconfig !== undefined) writeFileSync(join(root, 'tsconfig.json'), tsconfig);
  return root;
};
const read = (root: string, file: string) => readFileSync(join(root, file), 'utf8');
const json = (root: string, file: string) => JSON.parse(read(root, file)) as Record<string, never>;

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'nf-registry-'));
  registryDir = join(workspace, 'registry');
  publish('@acme/shapes', '1.0.0');
  publish('@acme/shapes', '1.1.0', {
    files: {
      'components/circle.ts': 'export class Circle {}\n',
      'components/nanoforge.manifest.json': JSON.stringify({
        contents: [{ kind: '@nanoforge/ecs:component', path: 'circle.ts', export: 'Circle' }],
      }),
      'assets/logo.png': 'png',
    },
    manifest: {
      include: ['components'],
      contents: [{ kind: 'asset', path: 'assets/' }],
      suggestedPlugins: ['@nanoforge/ecs'],
    },
  });
  publish('@acme/shapes', '2.0.0');
  publish('@acme/render', '1.0.0', {
    dependencies: { '@acme/shapes': '^1.0.0' },
    description: 'Draws shapes',
  });
  publish('@acme/physics', '1.0.0', { dependencies: { '@acme/shapes': '^2.0.0' } });
  publish('@acme/tools', '1.0.0', { type: 'plugin', engines: { editor: '>=0.1.0' } });
  publish('@acme/tools', '2.0.0', { type: 'plugin', engines: { editor: '>=9.0.0' } });
  writeFileSync(
    join(registryDir, '@acme/render/registry.json'),
    JSON.stringify({ author: 'Acme', downloads: 42 }),
  );
  writeFileSync(join(registryDir, '@acme/render/1.0.0/README.md'), '# Render\n');
  mkdirSync(join(registryDir, '@acme/shapes/notes'), { recursive: true });
  registry = new DirectoryRegistry(registryDir);
});
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

describe('registries', () => {
  const sources: Record<string, () => Registry> = {
    'a folder': () => registry,
    http: () =>
      new RegistryClient({
        baseUrl: 'https://registry.test',
        fetch: serveRegistry(registry) as typeof fetch,
      }),
  };

  it.each(Object.keys(sources))('searches, describes and downloads from %s', async (label) => {
    const source = sources[label]!();
    const all = await source.search();
    expect(all.total).toBe(4);
    expect(all.items.map((item) => item.name)).toEqual([
      '@acme/render',
      '@acme/physics',
      '@acme/shapes',
      '@acme/tools',
    ]);
    expect((await source.search({ type: 'plugin' })).items.map((item) => item.name)).toEqual([
      '@acme/tools',
    ]);
    expect((await source.search({ q: 'draws SHAPES' })).items.map((item) => item.name)).toEqual([
      '@acme/render',
    ]);
    expect((await source.search({ limit: 1, page: 2 })).items.map((item) => item.name)).toEqual([
      '@acme/physics',
    ]);

    const render = await source.get('@acme/render');
    expect(render).toMatchObject({
      type: 'package',
      version: '1.0.0',
      author: 'Acme',
      downloads: 42,
      readme: '# Render\n',
    });
    expect(render.versions[0]!.dependencies).toEqual({ '@acme/shapes': '^1.0.0' });
    const shapes = await source.get('@acme/shapes');
    expect(shapes.versions.map((entry) => entry.version)).toEqual(['2.0.0', '1.1.0', '1.0.0']);

    expect(shapes.versions[1]).toMatchObject({
      kinds: { asset: 1, '@nanoforge/ecs:component': 1 },
      suggestedPlugins: { '@nanoforge/ecs': '*' },
    });

    const archive = await source.download('@acme/shapes', '1.1.0');
    expect(sha256(archive)).toBe(shapes.versions[1]!.sha256);
    await expect(source.get('@acme/none')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(source.download('@acme/shapes', '9.9.9')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('speaks the npm registry layout over http', async () => {
    const serve = serveRegistry(registry);
    const get = async (path: string) => {
      const response = await serve(`https://registry.test${path}`);
      return { status: response.status, body: (await response.json()) as Record<string, never> };
    };
    const packument = await get('/registry/@acme%2Frender');
    expect(packument.body).toMatchObject({
      name: '@acme/render',
      type: 'package',
      'dist-tags': { latest: '1.0.0' },
      author: { name: 'Acme' },
      versions: {
        '1.0.0': {
          dependencies: { '@acme/shapes': '^1.0.0' },
          dist: { tarball: '/registry/@acme/render/-/render-1.0.0.zip' },
        },
      },
    });
    const shapes = await get('/registry/@acme%2Fshapes');
    expect(shapes.body).toMatchObject({
      versions: {
        '1.1.0': {
          contents: [
            { kind: 'asset', path: 'assets/' },
            {
              kind: '@nanoforge/ecs:component',
              path: 'components/circle.ts',
              export: 'Circle',
              manifest: 'components/nanoforge.manifest.json',
            },
          ],
          manifests: ['components/nanoforge.manifest.json'],
        },
      },
    });
    expect(
      (await registry.get('@acme/shapes')).versions.find((v) => v.version === '1.1.0'),
    ).toMatchObject({
      manifests: ['components/nanoforge.manifest.json'],
    });
    const search = await get('/registry/-/v1/search?text=draws&size=5');
    expect(search.body).toMatchObject({
      total: 1,
      objects: [{ package: { name: '@acme/render', version: '1.0.0' }, downloads: { total: 42 } }],
    });
    expect((await get('/registry/@acme/none')).status).toBe(404);
    expect(
      (await serve('https://registry.test/registry/@acme/render/-/other-1.0.0.zip')).status,
    ).toBe(404);
  });

  it('takes a registry without the search route as not available', async () => {
    const old = new RegistryClient({
      baseUrl: 'https://registry.test',
      fetch: (async () => new Response('{}', { status: 404 })) as typeof fetch,
    });
    await expect(old.search()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    await expect(old.get('@acme/render')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('says so when the registry cannot be reached or answers nonsense', async () => {
    const down = new RegistryClient({
      baseUrl: 'https://registry.test',
      fetch: (async () => {
        throw new Error('offline');
      }) as typeof fetch,
    });
    await expect(down.search()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    const odd = new RegistryClient({
      baseUrl: 'https://registry.test',
      fetch: (async () => new Response('{"objects":"no"}', { status: 200 })) as typeof fetch,
    });
    await expect(odd.search()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('follows versions published in the folder', async () => {
    publish('@acme/late', '1.0.0');
    expect((await registry.get('@acme/late')).version).toBe('1.0.0');
    publish('@acme/late', '1.1.0');
    expect((await registry.get('@acme/late')).version).toBe('1.1.0');
    rmSync(join(registryDir, '@acme/late'), { recursive: true });
    await expect(registry.get('@acme/late')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('picks the newest version that fits a range and this editor', async () => {
    const shapes = await registry.get('@acme/shapes');
    expect(pickVersion(shapes)?.version).toBe('2.0.0');
    expect(pickVersion(shapes, '^1.0.0')?.version).toBe('1.1.0');
    expect(pickVersion(shapes, '^3.0.0')).toBeUndefined();
    const tools = await registry.get('@acme/tools');
    expect(pickVersion(tools, '*', { editor: '0.1.0' })?.version).toBe('1.0.0');
    expect(pickVersion(tools, '*', { editor: '9.1.0' })?.version).toBe('2.0.0');
  });

  it('reads the documents the NanoForge API writes', async () => {
    const manifest = {
      name: '@acme/kit',
      version: '1.2.0',
      type: 'package',
      dependencies: ['@acme/shapes'],
      include: ['src'],
    };
    const archive = zipSync({
      'nanoforge.manifest.json': new TextEncoder().encode(JSON.stringify(manifest)),
      'src/nanoforge.manifest.json': new TextEncoder().encode('{"contents":[]}'),
    });
    const tarball = 'https://api.test/registry/@acme/kit/-/kit-1.2.0.zip';
    const version = {
      ...manifest,
      dependencies: { '@acme/shapes': '*' },
      contents: [
        {
          kind: '@nanoforge/ecs:component',
          path: 'src/velocity.ts',
          export: 'Velocity',
          manifest: 'src/nanoforge.manifest.json',
          fileCount: 1,
          size: 120,
        },
      ],
      manifests: ['src/nanoforge.manifest.json'],
      kinds: { '@nanoforge/ecs:component': 1 },
      suggestedPlugins: { '@nanoforge/ecs': '^1.0.0' },
      _id: '@acme/kit@1.2.0',
      _npmUser: { name: 'acme' },
      dist: {
        tarball,
        integrity: 'sha512-AAAA',
        shasum: '0'.repeat(40),
        sha256: sha256(archive),
        size: archive.length,
        unpackedSize: 200,
        fileCount: 2,
      },
    };
    const accepts: (string | null)[] = [];
    const api = new RegistryClient({
      baseUrl: 'https://api.test',
      fetch: (async (input: string, init?: RequestInit) => {
        const url = new URL(input);
        accepts.push(new Headers(init?.headers).get('accept'));
        if (url.pathname === '/registry/-/v1/search')
          return Response.json({
            objects: [
              {
                package: {
                  name: '@acme/kit',
                  scope: 'acme',
                  type: 'package',
                  version: '1.2.0',
                  keywords: [],
                  date: '2026-10-10T09:00:00.000Z',
                  publisher: { username: 'acme' },
                  kinds: version.kinds,
                  suggestedPlugins: version.suggestedPlugins,
                },
                downloads: { total: 3 },
                score: { final: 1 },
                searchScore: 1,
              },
            ],
            total: 1,
            time: 'Sat, 10 Oct 2026 09:00:00 GMT',
          });
        if (url.pathname === '/registry/@acme/kit')
          return Response.json({
            _id: '@acme/kit',
            name: '@acme/kit',
            type: 'package',
            keywords: [],
            readme: '',
            maintainers: [{ name: 'acme' }],
            'dist-tags': { latest: '1.2.0' },
            versions: { '1.2.0': version },
            time: { created: '…', modified: '…', '1.2.0': '2026-10-10T09:00:00.000Z' },
            downloads: { total: 3 },
          });
        if (url.toString() === tarball) return new Response(archive as BodyInit);
        return Response.json({ error: 'No such route' }, { status: 404 });
      }) as typeof fetch,
    });

    expect((await api.search()).items).toEqual([
      expect.objectContaining({
        name: '@acme/kit',
        author: 'acme',
        kinds: { '@nanoforge/ecs:component': 1 },
      }),
    ]);
    const kit = await api.get('@acme/kit');
    expect(kit).toMatchObject({ author: 'acme', kinds: { '@nanoforge/ecs:component': 1 } });
    expect(kit.versions[0]).toMatchObject({
      dependencies: { '@acme/shapes': '*' },
      suggestedPlugins: { '@nanoforge/ecs': '^1.0.0' },
    });

    accepts.length = 0;
    const target = join(workspace, 'api-kit');
    const installed = await installItem(api, {
      name: '@acme/kit',
      version: '1.2.0',
      type: 'package',
      target,
      sha256: kit.versions[0]!.sha256,
    });
    expect(installed.dependencies).toEqual({ '@acme/shapes': '*' });
    expect(existsSync(join(target, 'src/nanoforge.manifest.json'))).toBe(true);
    expect(accepts[0]).toContain('application/vnd.npm.install-v1+json');
  });

  it('keeps its headers off an address a redirect leads to on another origin', async () => {
    const seen: { url: string; authorization: string | null }[] = [];
    const api = new RegistryClient({
      baseUrl: 'https://api.test',
      headers: () => ({ authorization: 'Bearer secret' }),
      fetch: (async (input: string, init?: RequestInit) => {
        seen.push({ url: input, authorization: new Headers(init?.headers).get('authorization') });
        expect(init?.redirect).toBe('manual');
        const url = new URL(input);
        if (url.origin === 'https://api.test' && url.pathname === '/registry/-/v1/search')
          return new Response(null, {
            status: 302,
            headers: { location: 'https://elsewhere.test/search' },
          });
        if (url.origin === 'https://elsewhere.test')
          return new Response(null, { status: 307, headers: { location: '/again' } });
        return Response.json({ error: 'No such route' }, { status: 404 });
      }) as typeof fetch,
    });
    await expect(api.search()).rejects.toThrow(RegistryError);
    expect(seen).toEqual([
      {
        url: 'https://api.test/registry/-/v1/search?text=&from=0&size=30',
        authorization: 'Bearer secret',
      },
      { url: 'https://elsewhere.test/search', authorization: null },
      ...Array.from({ length: 4 }, () => ({
        url: 'https://elsewhere.test/again',
        authorization: null,
      })),
    ]);
  });
});

describe('installItem', () => {
  it('writes the folder, and replaces it', async () => {
    const target = join(workspace, 'plugins/@acme/tools');
    await installItem(registry, { name: '@acme/tools', version: '1.0.0', type: 'plugin', target });
    expect(json(target, 'nanoforge.manifest.json')).toMatchObject({ version: '1.0.0' });
    writeFileSync(join(target, 'leftover.txt'), 'old');
    await installItem(registry, { name: '@acme/tools', version: '2.0.0', type: 'plugin', target });
    expect(json(target, 'nanoforge.manifest.json')).toMatchObject({ version: '2.0.0' });
    expect(existsSync(join(target, 'leftover.txt'))).toBe(false);
  });

  it('writes nothing for a wrong hash, a wrong type, a wrong manifest or an unsafe archive', async () => {
    const target = join(workspace, 'refused/@acme/shapes');
    const request = { name: '@acme/shapes', version: '1.0.0', type: 'package', target } as const;
    await expect(
      installItem(registry, { ...request, sha256: '0'.repeat(64) }),
    ).rejects.toMatchObject({ code: 'INTEGRITY' });
    await expect(installItem(registry, { ...request, type: 'plugin' })).rejects.toMatchObject({
      code: 'INVALID',
    });
    await expect(installItem(registry, { ...request, name: '../evil' })).rejects.toMatchObject({
      code: 'INVALID',
    });
    const manifest = new TextEncoder().encode(
      JSON.stringify({ type: 'package', name: '@acme/shapes', version: '1.0.0' }),
    );
    const serving = (files: Record<string, Uint8Array>): Registry => ({
      ...registry,
      search: () => registry.search(),
      get: (name) => registry.get(name),
      download: async () => zipSync(files),
    });
    for (const path of ['../outside.txt', '/etc/passwd', 'a/../../b.txt', 'C:\\x.txt']) {
      await expect(
        installItem(serving({ 'nanoforge.manifest.json': manifest, [path]: manifest }), request),
      ).rejects.toMatchObject({ code: 'INVALID' });
    }
    await expect(installItem(serving({ 'other.json': manifest }), request)).rejects.toThrow(
      /no nanoforge.manifest.json/,
    );
    await expect(
      installItem(
        {
          ...serving({}),
          download: async () => new TextEncoder().encode('not a zip'),
        },
        request,
      ),
    ).rejects.toThrow(/not a zip/);
    expect(existsSync(join(workspace, 'refused'))).toBe(false);
    expect(existsSync(join(workspace, 'outside.txt'))).toBe(false);
  });

  it('refuses archives that claim to unpack to too much, before unpacking them', async () => {
    const target = join(workspace, 'bomb/@acme/shapes');
    const request = { name: '@acme/shapes', version: '1.0.0', type: 'package', target } as const;
    const zip = zipSync({
      'nanoforge.manifest.json': new Uint8Array(16),
      'big.bin': new Uint8Array(64),
    });
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    for (let offset = 0; offset < zip.length - 4; offset++) {
      const signature = view.getUint32(offset, true);
      if (signature === 0x04034b50) view.setUint32(offset + 22, 0x7fffffff, true);
      if (signature === 0x02014b50) view.setUint32(offset + 24, 0x7fffffff, true);
    }
    await expect(
      installItem(
        {
          search: () => registry.search(),
          get: (name) => registry.get(name),
          download: async () => zip,
        },
        request,
      ),
    ).rejects.toThrow(/too large/);
    expect(existsSync(target)).toBe(false);
  });

  it('keeps the installed copy when a reinstall fails', async () => {
    const target = join(workspace, 'kept/@acme/shapes');
    const request = { name: '@acme/shapes', version: '1.0.0', type: 'package', target } as const;
    await installItem(registry, request);
    const blocked = new Uint8Array(4);
    await expect(
      installItem(
        {
          search: () => registry.search(),
          get: (name) => registry.get(name),
          download: async () =>
            zipSync({
              'nanoforge.manifest.json': new TextEncoder().encode(
                JSON.stringify({ type: 'package', name: '@acme/shapes', version: '1.0.0' }),
              ),
              'index.ts': blocked,
              'index.ts/inside.ts': blocked,
            }),
        },
        request,
      ),
    ).rejects.toThrow();
    expect(read(target, 'index.ts')).toBe('// 1.0.0\n');
  });
});

describe('ProjectPackages', () => {
  it('installs a package with what it needs, side by side, and keeps the list and the lock', async () => {
    const root = project(
      'game',
      '{\n  // paths of the project\n  "compilerOptions": {\n    "strict": true\n  }\n}\n',
    );
    writeFileSync(join(root, '.gitignore'), 'node_modules\n');
    const packages = new ProjectPackages(root, registry);
    const installed = await packages.install('@acme/render');
    expect(installed).toEqual([
      { name: '@acme/render', version: '1.0.0', range: '^1.0.0', dependents: [], present: true },
      { name: '@acme/shapes', version: '1.1.0', dependents: ['@acme/render'], present: true },
    ]);
    expect(existsSync(join(root, 'nf_modules/@acme/shapes/components/circle.ts'))).toBe(true);
    expect(json(root, PACKAGES_FILE)).toEqual({ packages: { '@acme/render': '^1.0.0' } });
    expect(json(root, LOCK_FILE)).toMatchObject({
      lockVersion: 1,
      packages: {
        '@acme/render': { version: '1.0.0', dependencies: { '@acme/shapes': '^1.0.0' } },
        '@acme/shapes': { version: '1.1.0' },
      },
    });
    const tsconfig = read(root, 'tsconfig.json');
    expect(tsconfig).toContain('// paths of the project');
    expect(tsconfig).toContain('"@acme/render/*": ["./nf_modules/@acme/render/*"]');
    expect(tsconfig).toContain('"@acme/shapes/*": ["./nf_modules/@acme/shapes/*"]');
    expect(read(root, '.gitignore')).toBe('node_modules\n');

    await expect(packages.uninstall('@acme/shapes')).rejects.toMatchObject({ code: 'IN_USE' });
    expect(await packages.uninstall('@acme/render')).toEqual([]);
    expect(existsSync(join(root, 'nf_modules/@acme/render'))).toBe(false);
    expect(existsSync(join(root, 'nf_modules/@acme/shapes'))).toBe(false);
    expect(read(root, 'tsconfig.json')).not.toContain('@acme');
    expect(read(root, 'tsconfig.json')).toContain('// paths of the project');
    expect(read(root, '.gitignore')).toBe('node_modules\n');
    await expect(packages.uninstall('@acme/render')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses versions that cannot live together, plugins, and unknown names', async () => {
    const root = project('conflict');
    const packages = new ProjectPackages(root, registry);
    await packages.install('@acme/render');
    await expect(packages.install('@acme/physics')).rejects.toThrow(
      /No version of @acme\/shapes fits .*\^1\.0\.0 \(asked by @acme\/render@1\.0\.0\).*\^2\.0\.0/,
    );
    expect((await packages.list()).map((entry) => entry.name)).toEqual([
      '@acme/render',
      '@acme/shapes',
    ]);
    expect(json(root, PACKAGES_FILE)).toEqual({ packages: { '@acme/render': '^1.0.0' } });
    await expect(packages.install('@acme/tools')).rejects.toThrow(/is a plugin, not a package/);
    await expect(packages.install('@acme/none')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(packages.install('../../etc')).rejects.toMatchObject({ code: 'INVALID' });
  });

  it('keeps installed versions until asked to update, in the range or to the latest', async () => {
    const root = project('update');
    const packages = new ProjectPackages(root, registry);
    await packages.install('@acme/shapes', '~1.0.0');
    expect(await packages.outdated()).toEqual([
      {
        name: '@acme/shapes',
        version: '1.0.0',
        range: '~1.0.0',
        dependents: [],
        present: true,
        latest: '2.0.0',
      },
    ]);
    writeFileSync(
      join(root, PACKAGES_FILE),
      JSON.stringify({ packages: { '@acme/shapes': '^1.0.0' } }),
    );
    expect((await packages.outdated())[0]).toMatchObject({ wanted: '1.1.0', latest: '2.0.0' });
    expect((await packages.list())[0]!.version).toBe('1.0.0');
    expect((await packages.update('@acme/shapes'))[0]).toMatchObject({ version: '1.1.0' });
    expect((await packages.update('@acme/shapes', true))[0]).toMatchObject({
      version: '2.0.0',
      range: '^2.0.0',
    });
    expect(json(root, 'nf_modules/@acme/shapes/nanoforge.manifest.json')).toMatchObject({
      version: '2.0.0',
    });
  });

  it('offers a dependency only the versions its dependents accept', async () => {
    const root = project('dependency');
    const packages = new ProjectPackages(root, registry);
    await packages.install('@acme/shapes', '1.0.0');
    await packages.install('@acme/render');
    writeFileSync(join(root, PACKAGES_FILE), JSON.stringify({ packages: { '@acme/render': '*' } }));
    const shapes = (await packages.outdated()).find((entry) => entry.name === '@acme/shapes')!;
    expect(shapes).toMatchObject({ version: '1.0.0', wanted: '1.1.0', latest: '2.0.0' });
    const updated = await packages.update('@acme/shapes');
    expect(updated.find((entry) => entry.name === '@acme/shapes')).toMatchObject({
      version: '1.1.0',
      dependents: ['@acme/render'],
    });
  });

  it('restores nf_modules from the lock, checking the hashes', async () => {
    const root = project('restore');
    const packages = new ProjectPackages(root, registry);
    await packages.install('@acme/render');
    rmSync(join(root, 'nf_modules'), { recursive: true });
    expect((await packages.list()).map((entry) => entry.present)).toEqual([false, false]);
    expect((await packages.restore()).map((entry) => entry.present)).toEqual([true, true]);
    expect(existsSync(join(root, 'nf_modules/@acme/shapes/components/circle.ts'))).toBe(true);

    rmSync(join(root, 'nf_modules'), { recursive: true });
    const lock = json(root, LOCK_FILE) as unknown as {
      packages: Record<string, { sha256: string }>;
    };
    lock.packages['@acme/shapes']!.sha256 = 'f'.repeat(64);
    writeFileSync(join(root, LOCK_FILE), JSON.stringify(lock));
    await expect(packages.restore()).rejects.toBeInstanceOf(RegistryError);
    lock.packages['@acme/shapes']!.sha256 = '';
    writeFileSync(join(root, LOCK_FILE), JSON.stringify(lock));
    await expect(packages.restore()).rejects.toMatchObject({ code: 'INVALID' });
    writeFileSync(join(root, LOCK_FILE), '{ not json');
    await expect(packages.restore()).rejects.toMatchObject({ code: 'INVALID' });
  });

  it('restores the version the lock says when another one is installed', async () => {
    const root = project('restore-bump');
    const packages = new ProjectPackages(root, registry);
    await packages.install('@acme/shapes', '1.0.0');
    const lock = json(root, LOCK_FILE) as unknown as {
      packages: Record<string, { version: string; sha256: string }>;
    };
    const bumped = await registry.get('@acme/shapes');
    const next = bumped.versions.find((entry) => entry.version === '1.1.0')!;
    lock.packages['@acme/shapes'] = {
      ...lock.packages['@acme/shapes']!,
      version: '1.1.0',
      sha256: next.sha256,
    };
    writeFileSync(join(root, LOCK_FILE), JSON.stringify(lock));
    await packages.restore();
    expect(json(root, 'nf_modules/@acme/shapes/nanoforge.manifest.json')).toMatchObject({
      version: '1.1.0',
    });
  });

  it('refuses a locked version whose archive changed in the registry', async () => {
    const root = project('integrity');
    const packages = new ProjectPackages(root, registry);
    await packages.install('@acme/shapes', '1.0.0');
    const lock = json(root, LOCK_FILE) as unknown as {
      packages: Record<string, { sha256: string }>;
    };
    lock.packages['@acme/shapes']!.sha256 = 'a'.repeat(64);
    writeFileSync(join(root, LOCK_FILE), JSON.stringify(lock));
    await expect(packages.install('@acme/render')).rejects.toMatchObject({ code: 'INTEGRITY' });
    expect(json(root, LOCK_FILE)).toEqual(lock);
    expect(existsSync(join(root, 'nf_modules/@acme/render'))).toBe(false);
  });

  it('puts every package back when one of several fails to install', async () => {
    const root = project('rollback');
    const failing = Object.create(registry) as typeof registry;
    failing.download = async (name: string, version: string) => {
      if (name === '@acme/shapes') throw new RegistryError('UNAVAILABLE', 'network down');
      return registry.download(name, version);
    };
    const broken = new ProjectPackages(root, failing);
    await expect(broken.install('@acme/render')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(existsSync(join(root, 'nf_modules/@acme/render'))).toBe(false);
    expect(existsSync(join(root, LOCK_FILE))).toBe(false);
    expect(existsSync(join(root, PACKAGES_FILE))).toBe(false);
  });

  it('removes on restore the packages the lock no longer lists', async () => {
    const root = project('restore-removed');
    const packages = new ProjectPackages(root, registry);
    await packages.install('@acme/shapes', '1.0.0');
    writeFileSync(join(root, LOCK_FILE), JSON.stringify({ lockVersion: 1, packages: {} }));
    mkdirSync(join(root, 'nf_modules/@acme/left.nf-old-1234'), { recursive: true });
    await packages.restore();
    expect(readdirSync(join(root, 'nf_modules/@acme'))).toEqual([]);
  });

  it('runs changes of one project one after the other', async () => {
    const root = project('queue');
    const packages = new ProjectPackages(root, registry);
    const [first, second] = await Promise.all([
      packages.install('@acme/shapes', '^1.0.0'),
      packages.install('@acme/render'),
    ]);
    expect(first.map((entry) => entry.name)).toEqual(['@acme/shapes']);
    expect(second.map((entry) => entry.name)).toEqual(['@acme/render', '@acme/shapes']);
    expect(json(root, PACKAGES_FILE)).toEqual({
      packages: { '@acme/render': '^1.0.0', '@acme/shapes': '^1.0.0' },
    });
  });
});

describe('ItemVersion', () => {
  it('takes only versions semver reads as they are', () => {
    for (const version of ['1.0.0', '1.2.3-beta.1', '0.0.1'])
      expect(ItemVersion.safeParse(version).success).toBe(true);
    for (const version of ['01.0.0', '1.0.0-..', 'v1.0.0', '1.0'])
      expect(ItemVersion.safeParse(version).success).toBe(false);
  });
});

describe('tsconfig paths', () => {
  it('adds and removes entries, keeping comments', () => {
    const text =
      '{\n  // comment\n  "compilerOptions": {\n    "paths": {\n      "@x/a/*": ["./libs/a/src/*"]\n    }\n  }\n}\n';
    const added = withPathsEntry(text, '@acme/b/*', './nf_modules/@acme/b/*');
    expect(added).toContain('// comment');
    expect(added).toContain('"@acme/b/*": ["./nf_modules/@acme/b/*"],');
    expect(withPathsEntry(added, '@acme/b/*', './nf_modules/@acme/b/*')).toBe(added);
    expect(withoutPathsEntry(added, '@acme/b/*')).toBe(text);
    const two =
      '{\n  "compilerOptions": {\n    "paths": {\n      "@x/a/*": ["./a/*"],\n      "@x/b/*": ["./b/*"]\n    }\n  },\n  "exclude": ["dist"]\n}\n';
    expect(withoutPathsEntry(two, '@x/b/*')).toBe(
      '{\n  "compilerOptions": {\n    "paths": {\n      "@x/a/*": ["./a/*"]\n    }\n  },\n  "exclude": ["dist"]\n}\n',
    );
    const removed = withoutPathsEntry(added, '@x/a/*');
    expect(JSON.parse(removed.replace('// comment', ''))).toEqual({
      compilerOptions: { paths: { '@acme/b/*': ['./nf_modules/@acme/b/*'] } },
    });
    expect(withoutPathsEntry(text, '@none/*')).toBe(text);
    expect(JSON.parse(withPathsEntry('{}\n', '@a/b/*', './x/*'))).toEqual({
      compilerOptions: { paths: { '@a/b/*': ['./x/*'] } },
    });
  });
});
