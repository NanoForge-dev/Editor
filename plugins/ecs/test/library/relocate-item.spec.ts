import { describe, expect, it, vi } from 'vitest';

import {
  type AppModel,
  type CatalogItem,
  CodeServiceToken,
  DocumentServiceToken,
  type PluginContext,
  ProjectServiceToken,
} from '@nanoforge-dev/editor-sdk';

import { relocateItem } from '../../src/library/relocate-item';
import { RELOCATED_TEXT_ANALYZER } from '../../src/model/ecs.const';

vi.mock('@nanoforge-dev/editor-sdk/ui', () => ({
  NotificationServiceToken: Symbol('notifications'),
}));

/** A project in memory whose writes can be made to fail. */
const setup = () => {
  const files = new Map([['apps/client/src/components/position.ts', 'export class Position {}']]);
  const fs = {
    failWrites: false,
    entry: (path: string) => (files.has(path) ? { path } : undefined),
    rename: async (from: string, to: string) => {
      files.set(to, files.get(from)!);
      files.delete(from);
    },
    write: async (path: string, text: string) => {
      if (fs.failWrites) throw new Error('Disk full');
      files.set(path, text);
    },
    delete: async (path: string) => void files.delete(path),
  };
  const services = new Map<unknown, unknown>([
    [
      CodeServiceToken,
      {
        analyze: async (_path: string, analyzer: string) =>
          analyzer === RELOCATED_TEXT_ANALYZER
            ? { text: 'export class Position {} /* moved */', imports: [] }
            : [],
        edit: async () => undefined,
      },
    ],
    [DocumentServiceToken, { getText: async (path: string) => files.get(path) ?? '' }],
    [
      ProjectServiceToken,
      { current: { get: () => ({ fs, model: { get: () => ({ apps: [] }) } }) } },
    ],
  ]);
  const context = {
    name: '@nanoforge/ecs',
    services: {
      tryGet: (token: unknown) => services.get(token),
      get: (t: unknown) => services.get(t),
    },
  } as unknown as PluginContext;
  const item = {
    meta: { source: 'apps/client/src/components/position.ts', export: 'Position' },
  } as unknown as CatalogItem;
  const target = {
    name: '@pong/shared',
    type: 'lib',
    dirs: { components: 'libs/shared/src/components', systems: 'libs/shared/src/systems' },
  } as unknown as AppModel;
  return { context, item, target, files, fs };
};

describe('relocateItem', () => {
  it('moves an item file with its new text', async () => {
    const { context, item, target, files } = setup();
    expect(await relocateItem(context, item, target, true)).toBe(true);
    expect([...files]).toEqual([
      ['libs/shared/src/components/position.ts', 'export class Position {} /* moved */'],
    ]);
  });

  it('leaves the file where it was when its new text cannot be written', async () => {
    const { context, item, target, files, fs } = setup();
    fs.failWrites = true;
    expect(await relocateItem(context, item, target, true)).toBe(false);
    expect([...files]).toEqual([
      ['apps/client/src/components/position.ts', 'export class Position {}'],
    ]);
  });
});
