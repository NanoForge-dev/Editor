import { z } from 'zod';

import { defineSetting } from '@nanoforge-dev/editor-settings';

/** Settings of the game runtime (play controls). */
export const RuntimeSettings = {
  playMode: defineSetting<'auto' | 'client' | 'server' | 'server+client'>({
    key: 'runtime.playMode',
    schema: z.enum(['auto', 'client', 'server', 'server+client']),
    default: 'auto',
    title: 'Play mode',
    description:
      'What Play starts: the client, the game server, or both (auto: both when the project has a server).',
    category: 'Runtime',
    scopes: ['account', 'machine', 'project', 'projectLocal'],
  }),
  clientApp: defineSetting({
    key: 'runtime.clientApp',
    schema: z.string(),
    default: '',
    title: 'Client app',
    description:
      'The client Play starts, in a project with several (its folder, like apps/client). Empty: the first one.',
    category: 'Runtime',
    scopes: ['project', 'projectLocal'],
  }),
  serverApp: defineSetting({
    key: 'runtime.serverApp',
    schema: z.string(),
    default: '',
    title: 'Server app',
    description:
      'The server Play starts, in a project with several (its folder, like apps/server). Empty: the first one.',
    category: 'Runtime',
    scopes: ['project', 'projectLocal'],
  }),
  saveBeforePlay: defineSetting({
    key: 'runtime.saveBeforePlay',
    schema: z.boolean(),
    default: true,
    title: 'Save all before Play',
    description: 'Play saves every open file first, so the game always matches what you see.',
    category: 'Runtime',
  }),
  env: defineSetting({
    key: 'runtime.env',
    schema: z.record(z.string().regex(/^NANOFORGE_\w+$/), z.string()),
    default: {},
    title: 'Environment overrides',
    description:
      'NANOFORGE_* variables applied on top of the project .env when playing (NANOFORGE_CLIENT_*, NANOFORGE_SERVER_*).',
    category: 'Runtime',
    scopes: ['project', 'projectLocal'],
    mergeStrategy: 'deep',
  }),
};
