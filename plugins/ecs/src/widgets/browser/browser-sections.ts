import type { CatalogItem } from '@nanoforge-dev/editor-sdk';

import { ecsData } from '../../service/ecs-data';

/** Items of one source: an app, a shared library or an installed package. */
export interface BrowserSection {
  readonly title: string;
  readonly readonly: boolean;
  readonly items: CatalogItem[];
}

const RANK = { app: 0, lib: 1, module: 2 } as const;

/** The components and systems a search keeps, by source: apps, libraries, then packages. */
export const browserSections = (items: readonly CatalogItem[], query: string): BrowserSection[] => {
  const search = query.trim().toLowerCase();
  const bySource = new Map<string, BrowserSection>();
  for (const item of items) {
    if (!ecsData(item)) continue;
    if (
      search &&
      !item.meta.export.toLowerCase().includes(search) &&
      !(item.meta.description ?? '').toLowerCase().includes(search)
    )
      continue;
    const key = `${item.source.kind}:${item.source.name}`;
    const title =
      item.source.kind === 'app'
        ? `App ${item.source.name}`
        : item.source.kind === 'lib'
          ? `Shared library ${item.source.name}`
          : `Installed package ${item.source.name}`;
    const section = bySource.get(key) ?? { title, readonly: item.readonly, items: [] };
    section.items.push(item);
    bySource.set(key, section);
  }
  return [...bySource.entries()]
    .sort(
      ([a], [b]) =>
        RANK[a.split(':')[0] as keyof typeof RANK] - RANK[b.split(':')[0] as keyof typeof RANK] ||
        a.localeCompare(b),
    )
    .map(([, section]) => section);
};

/** Components the app can use that share an ECS name: the registry would mix them up. */
export const nameCollisions = (items: readonly CatalogItem[]): [string, CatalogItem[]][] => {
  const byName = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const data = ecsData(item);
    if (data?.type !== 'component') continue;
    byName.set(data.name, [...(byName.get(data.name) ?? []), item]);
  }
  return [...byName].filter(([, list]) => list.length > 1);
};
