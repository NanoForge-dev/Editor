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
const installed = (path: string) => path === 'nf_modules/@acme/physics';

describe('nameTaken', () => {
  it('names what a new package name would clash with', () => {
    expect(nameTaken('pong', project, installed)).toMatch(/project's own name/);
    expect(nameTaken('@pong/shared', project, installed)).toMatch(/a shared library/);
    expect(nameTaken('@pong/client', project, installed)).toMatch(/the client app/);
    expect(nameTaken('@nanoforge-dev/ecs', project, installed)).toMatch(/engine library/);
    expect(nameTaken('@acme/physics', project, installed)).toMatch(/installed package/);
    expect(nameTaken('@pong/server', project, installed)).toBeUndefined();
  });

  it('lets an app keep its own name when renamed', () => {
    expect(nameTaken('@pong/shared', project, installed, 'shared')).toBeUndefined();
  });
});
