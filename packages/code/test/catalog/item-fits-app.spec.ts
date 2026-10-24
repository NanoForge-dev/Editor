import { describe, expect, it } from 'vitest';

import type { AppModel } from '@nanoforge-dev/editor-protocol';

import type { CatalogItem } from '../../src/catalog/catalog.type';
import { itemFitsApp } from '../../src/catalog/item-fits-app';

const app = (root: string, type: AppModel['type'], libraries: string[]): AppModel =>
  ({ id: root, root, name: root, type, libraries, engineLibs: {} }) as never;
const item = (source: CatalogItem['source'], side = 'shared'): CatalogItem =>
  ({ source, meta: { side, requires: [] } }) as never;

describe('itemFitsApp', () => {
  const position = item({ kind: 'lib', name: '@pong/shared', path: 'libs/shared' });

  it('offers the items of a shared library to the apps that use it', () => {
    expect(itemFitsApp(position, app('apps/client', 'client', ['@pong/shared']))).toBe(true);
    expect(itemFitsApp(position, app('apps/server', 'server', []))).toBe(false);
    expect(itemFitsApp(position, app('apps/server', 'server', ['@pong/other']))).toBe(false);
  });

  it('offers them to the library itself, and to a library that uses it', () => {
    expect(itemFitsApp(position, app('libs/shared', 'lib', []))).toBe(true);
    expect(itemFitsApp(position, app('libs/ui', 'lib', ['@pong/shared']))).toBe(true);
    expect(itemFitsApp(position, app('libs/ui', 'lib', []))).toBe(false);
  });

  it('still keeps a client item of a used library out of a server', () => {
    const sprite = item({ kind: 'lib', name: '@pong/shared', path: 'libs/shared' }, 'client');
    expect(itemFitsApp(sprite, app('apps/server', 'server', ['@pong/shared']))).toBe(false);
  });
});
