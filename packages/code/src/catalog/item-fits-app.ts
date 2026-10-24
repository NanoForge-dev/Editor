import type { AppModel } from '@nanoforge-dev/editor-protocol';

import type { CatalogItem } from './catalog.type';

/** The name in an app's item references: its folder (`apps/client` → `client`). */
export const appRefName = (app: AppModel): string =>
  (app.root.split('/').pop() || app.name).replace(/[^\w.-]/g, '-');

export const within = (path: string, folder: string) =>
  folder === '' || path === folder || path.startsWith(`${folder}/`);

/**
 * Whether an item can go in an app: its side, the engine libraries it imports and, for an item
 * of a shared library, that the app uses that library.
 */
export const itemFitsApp = (item: CatalogItem, app: AppModel): boolean => {
  if (item.source.kind === 'app' && item.source.path !== app.root) return false;
  if (
    item.source.kind === 'lib' &&
    item.source.path !== app.root &&
    !app.libraries.includes(item.source.name)
  )
    return false;
  const side = item.meta.side;
  if (side !== 'shared' && !(app.type === side)) return false;
  return item.meta.requires
    .filter((name) => name.startsWith('@nanoforge-dev/'))
    .every((name) => name in app.engineLibs);
};
