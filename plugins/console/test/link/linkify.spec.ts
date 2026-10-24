import { describe, expect, it } from 'vitest';

import { linkify } from '../../src/link/linkify';

const FILES = new Set(['apps/client/src/main.ts', 'package.json', 'apps/server/src/main.ts']);
const exists = (path: string) => FILES.has(path);
const targets = (text: string) =>
  linkify(text, exists)
    .filter((segment) => segment.target)
    .map((segment) => [segment.text, segment.target]);

describe('linkify', () => {
  it('links project paths with their position', () => {
    expect(targets('error at apps/client/src/main.ts:12:3 here')).toEqual([
      [
        'apps/client/src/main.ts:12:3',
        { kind: 'file', path: 'apps/client/src/main.ts', line: 12, column: 3 },
      ],
    ]);
    expect(targets('apps/client/src/main.ts(4,7): error TS2322')).toEqual([
      [
        'apps/client/src/main.ts(4,7)',
        { kind: 'file', path: 'apps/client/src/main.ts', line: 4, column: 7 },
      ],
    ]);
    expect(targets('see ./package.json')).toEqual([
      ['./package.json', { kind: 'file', path: 'package.json' }],
    ]);
  });

  it('keeps the text around links', () => {
    expect(linkify('a package.json b', exists).map((segment) => segment.text)).toEqual([
      'a ',
      'package.json',
      ' b',
    ]);
    expect(linkify('nothing here, v1.2 e.g. missing.ts:3', exists)).toEqual([
      { text: 'nothing here, v1.2 e.g. missing.ts:3' },
    ]);
  });

  it('finds the project file of an absolute path', () => {
    expect(targets('    at /home/me/pong/apps/server/src/main.ts:8:1')).toEqual([
      [
        '/home/me/pong/apps/server/src/main.ts:8:1',
        { kind: 'file', path: 'apps/server/src/main.ts', line: 8, column: 1 },
      ],
    ]);
  });

  it('marks frames of bundles for source mapping', () => {
    expect(
      targets(
        '    at update (http://localhost:4790/runtime/p/apps%2Fclient/main.js?v=ab&run=2:10:5)',
      ),
    ).toEqual([
      [
        'http://localhost:4790/runtime/p/apps%2Fclient/main.js?v=ab&run=2:10:5',
        {
          kind: 'frame',
          file: 'http://localhost:4790/runtime/p/apps%2Fclient/main.js?v=ab&run=2',
          line: 10,
          column: 5,
        },
      ],
    ]);
    expect(targets('at /home/me/pong/apps/server/.nanoforge/server/main.js:30:2')).toEqual([
      [
        '/home/me/pong/apps/server/.nanoforge/server/main.js:30:2',
        {
          kind: 'frame',
          file: '/home/me/pong/apps/server/.nanoforge/server/main.js',
          line: 30,
          column: 2,
        },
      ],
    ]);
  });
});
