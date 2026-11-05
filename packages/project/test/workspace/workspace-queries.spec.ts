import { describe, expect, it } from 'vitest';

import type { AppModel } from '@nanoforge-dev/editor-protocol';

import { nameTaken } from '../../src/workspace/workspace-queries';

const app = (id: string, name: string, type: AppModel['type'], engineLibs = {}) =>
  ({ id, name, type, engineLibs }) as AppModel;

const project = {
  name: 'pong',
  apps: [
    app('client', '@pong/client', 'client', { '@nanoforge-dev/ecs': '^1.0.0' }),
    app('shared', '@pong/shared', 'lib'),
  ],
};
const exists = (path: string) => path === 'nf_modules/@acme/physics' || path === 'package.json';

describe('nameTaken', () => {
  it('names what a new package name would clash with', () => {
    expect(nameTaken('pong', project, exists)).toMatch(/project's own name/);
    expect(nameTaken('@pong/shared', project, exists)).toMatch(/a shared library/);
    expect(nameTaken('@pong/client', project, exists)).toMatch(/the client app/);
    expect(nameTaken('@nanoforge-dev/ecs', project, exists)).toMatch(/engine library/);
    expect(nameTaken('@acme/physics', project, exists)).toMatch(/installed package/);
    expect(nameTaken('@pong/server', project, exists)).toBeUndefined();
  });

  it("takes a folder's name when the project has no root package.json", () => {
    expect(nameTaken('pong', project, () => false)).toBeUndefined();
  });

  it('lets an app keep its own name when renamed', () => {
    expect(nameTaken('@pong/shared', project, exists, 'shared')).toBeUndefined();
  });
});
