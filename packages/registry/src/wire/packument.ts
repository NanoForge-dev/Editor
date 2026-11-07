import { type z } from 'zod';

import type { RegistryItem, RegistrySummary } from '../item/item.schema';
import { type Packument, ROUTES, type WireSearch } from './wire.schema';

/** The packument of an item, in the shape the API writes it. */
export const toPackument = (item: RegistryItem): z.input<typeof Packument> => ({
  name: item.name,
  type: item.type,
  description: item.description,
  keywords: item.keywords,
  ...(item.author && { author: { name: item.author } }),
  maintainers: item.author ? [{ name: item.author }] : [],
  readme: item.readme,
  'dist-tags': { latest: item.version },
  versions: Object.fromEntries(
    item.versions.map((version) => [
      version.version,
      {
        name: item.name,
        version: version.version,
        type: item.type,
        dependencies: version.dependencies,
        engines: version.engines,
        kinds: version.kinds,
        suggestedPlugins: version.suggestedPlugins,
        contents: version.contents,
        manifests: version.manifests,
        dist: { tarball: ROUTES.archive(item.name, version.version), sha256: version.sha256 },
      },
    ]),
  ),
  time: Object.fromEntries(item.versions.map((version) => [version.version, version.publishedAt])),
  downloads: { total: item.downloads },
});

export const fromPackument = (packument: Packument, compare: (a: string, b: string) => number) => {
  const versions = Object.values(packument.versions)
    .map((version) => ({
      version: version.version,
      publishedAt: packument.time[version.version] ?? '',
      sha256: version.dist.sha256,
      dependencies: version.dependencies,
      engines: version.engines,
      kinds: version.kinds,
      suggestedPlugins: version.suggestedPlugins,
      contents: version.contents ?? [],
      manifests: version.manifests ?? [],
    }))
    .sort((a, b) => compare(a.version, b.version));
  const latest = packument['dist-tags'].latest;
  const item: RegistryItem = {
    name: packument.name,
    type: packument.type,
    version: latest,
    description: packument.description,
    keywords: packument.keywords,
    author: packument.author?.name || packument.maintainers[0]?.name || '',
    downloads: packument.downloads?.total ?? 0,
    updatedAt: packument.time[latest] ?? '',
    kinds: packument.versions[latest]?.kinds ?? {},
    readme: packument.readme ?? '',
    versions,
  };
  return item;
};

/** A search result, in the shape the API writes it. */
export const toSearchObject = (item: RegistrySummary): WireSearch['objects'][number] => ({
  package: {
    name: item.name,
    type: item.type,
    version: item.version,
    description: item.description,
    keywords: item.keywords,
    date: item.updatedAt,
    ...(item.author && { author: { name: item.author }, publisher: { username: item.author } }),
    kinds: item.kinds,
  },
  downloads: { total: item.downloads },
});

export const fromSearchObject = (entry: WireSearch['objects'][number]): RegistrySummary => ({
  name: entry.package.name,
  type: entry.package.type,
  version: entry.package.version,
  description: entry.package.description,
  keywords: entry.package.keywords,
  author: entry.package.author?.name || entry.package.publisher?.username || '',
  downloads: entry.downloads?.total ?? 0,
  updatedAt: entry.package.date,
  kinds: entry.package.kinds,
});
