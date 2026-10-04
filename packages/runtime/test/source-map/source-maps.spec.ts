import { describe, expect, it } from 'vitest';

import type { AppModel } from '@nanoforge-dev/editor-protocol';

import { SourceMaps } from '../../src/source-map/source-maps';

const app = (id: string, outDir: string): AppModel =>
  ({ id, name: id, type: 'client', root: id, language: 'ts', outDir }) as AppModel;

const MAP = JSON.stringify({
  version: 3,
  sources: ['../src/main.ts', '../../../node_modules/lib/index.js', '../../../../outside.ts'],
  names: [],
  mappings: 'AAAA;AACA;AACA;ACFA;ACAA',
});

const setup = () => {
  const fetched: string[] = [];
  const maps = new SourceMaps({
    projectId: 'p1',
    origin: 'http://localhost:4790',
    apps: () => [app('apps/client', 'apps/client/dist'), app('apps/server', 'apps/server/dist')],
    fetchText: async (url) => {
      fetched.push(url);
      return url.endsWith('/main.js.map') ? MAP : undefined;
    },
  });
  return { maps, fetched };
};

describe('SourceMaps', () => {
  it('maps a frame of a client bundle URL to the project file', async () => {
    const { maps, fetched } = setup();
    const url = 'http://localhost:4790/runtime/p1/apps%2Fclient/main.js?v=ab&run=2';
    expect(await maps.locate(url, 3, 1)).toEqual({
      path: 'apps/client/src/main.ts',
      line: 3,
      column: 1,
    });
    expect(fetched).toEqual(['http://localhost:4790/runtime/p1/apps%2Fclient/main.js.map']);
    await maps.locate(url, 2, 1);
    expect(fetched).toHaveLength(1);
    maps.invalidate('apps/client');
    await maps.locate(url, 2, 1);
    expect(fetched).toHaveLength(2);
  });

  it('maps a frame of a server bundle path', async () => {
    const { maps } = setup();
    expect(await maps.locate('/home/me/pong/apps/server/dist/main.js', 2, 5)).toEqual({
      path: 'apps/server/src/main.ts',
      line: 2,
      column: 1,
    });
  });

  it('gives nothing for libraries, files outside the project, or bundles without a map', async () => {
    const { maps } = setup();
    const url = 'http://localhost:4790/runtime/p1/apps%2Fclient/main.js';
    expect(await maps.locate(url, 4, 1)).toBeUndefined();
    expect(await maps.locate(url, 5, 1)).toBeUndefined();
    expect(await maps.locate(url, 99, 1)).toBeUndefined();
    expect(
      await maps.locate('http://localhost:4790/runtime/p1/apps%2Fclient/other.js', 1, 1),
    ).toBeUndefined();
    expect(await maps.locate('http://localhost:4790/runtime/p2/x/main.js', 1, 1)).toBeUndefined();
    expect(await maps.locate('/usr/lib/thing.js', 1, 1)).toBeUndefined();
  });
});
