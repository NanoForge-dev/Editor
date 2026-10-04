import { describe, expect, it } from 'vitest';

import { createApp, removeApp, renameApp } from '../../src/workspace/app-operations';
import { addEditorLibrary, withEditorLibrary } from '../../src/workspace/editor-library';
import { client, editPackage, model, project, server } from '../fixtures/workspace';

describe('apps', () => {
  it('adds an empty app with the engine versions the project has', async () => {
    const { io, files, snapshot } = project();
    const before = snapshot();
    const undo = await createApp(io, model(client, server), {
      type: 'client',
      folder: 'spectator',
      name: 'pong-spectator',
    });
    expect(JSON.parse(files.get('apps/spectator/package.json')!)).toEqual({
      name: 'pong-spectator',
      version: '0.0.0',
      private: true,
      type: 'module',
      devDependencies: {
        '@nanoforge-dev/core': '^2.0.0',
        '@nanoforge-dev/ecs': '^2.0.0',
        typescript: '^6.0.0',
      },
    });
    expect(files.get('apps/spectator/nanoforge.config.ts')).toContain('type: "client"');
    expect(files.get('apps/spectator/tsconfig.json')).toBe(files.get('apps/client/tsconfig.json'));
    expect(files.get('apps/spectator/src/main.ts')).toContain('createClient');
    await undo();
    expect(snapshot()).toEqual(before);
  });

  it('adds an app as a copy of another, without its build output', async () => {
    const { io, files } = project();
    await createApp(io, model(client, server), {
      type: 'client',
      folder: 'client-two',
      name: 'pong-client-two',
      from: client,
    });
    expect(files.get('apps/client-two/src/main.ts')).toBe('export const main = 1;\n');
    expect(JSON.parse(files.get('apps/client-two/package.json')!).name).toBe('pong-client-two');
    expect(files.has('apps/client-two/dist/main.js')).toBe(false);
    expect(files.has('apps/client/dist/main.js')).toBe(true);

    await expect(
      createApp(io, model(client, server), { type: 'client', folder: 'client', name: 'x' }),
    ).rejects.toThrow(/already exists/);
    await expect(
      createApp(io, model(client, server), { type: 'client', folder: 'new', name: 'pong-server' }),
    ).rejects.toThrow(/already the name/);
  });

  it('registers the editor library in an app, next to its engine libraries', async () => {
    const { io, files, snapshot } = project();
    files.set(
      'apps/client/src/main.ts',
      [
        'import { NanoforgeFactory } from "@nanoforge-dev/core";',
        'import { EcsLibrary } from "@nanoforge-dev/ecs/client";',
        '',
        'import { move } from "./systems/systems";',
        '',
        'export const main = async (options) => {',
        '  const app = NanoforgeFactory.createClient();',
        '  const ecs = new EcsLibrary();',
        '',
        '  app.use(ecs);',
        '',
        '  await app.init(options);',
        '  await app.run();',
        '};',
        '',
      ].join('\n'),
    );
    const before = snapshot();
    const entry = { ...client, entryFile: 'apps/client/src/main.ts' };

    const undo = await addEditorLibrary(io, entry);
    expect(files.get('apps/client/src/main.ts')).toBe(
      [
        'import { NanoforgeFactory } from "@nanoforge-dev/core";',
        'import { EcsLibrary } from "@nanoforge-dev/ecs/client";',
        'import { EditorLibrary } from "@nanoforge-dev/editor-lib";',
        '',
        'import { move } from "./systems/systems";',
        '',
        'export const main = async (options) => {',
        '  const app = NanoforgeFactory.createClient();',
        '  const ecs = new EcsLibrary();',
        '',
        '  app.use(ecs);',
        '  app.use(new EditorLibrary());',
        '',
        '  await app.init(options);',
        '  await app.run();',
        '};',
        '',
      ].join('\n'),
    );
    expect(JSON.parse(files.get('apps/client/package.json')!).devDependencies).toMatchObject({
      '@nanoforge-dev/core': '^2.0.0',
      '@nanoforge-dev/editor-lib': '^2.0.0',
    });

    await expect(addEditorLibrary(io, entry)).rejects.toThrow(/already registers/);
    await undo();
    expect(snapshot()).toEqual(before);

    files.set('apps/client/src/main.ts', 'export const main = async () => {};\n');
    await expect(addEditorLibrary(io, entry)).rejects.toThrow(/by hand/);
    expect(withEditorLibrary('const a = 1;')).toBeUndefined();
  });

  it('gives a new app the editor library when the project has it', async () => {
    const { io, files } = project();
    await editPackage(files, 'apps/client/package.json', '@nanoforge-dev/editor-lib', '^2.0.0');
    await createApp(io, model(client, server), {
      type: 'client',
      folder: 'spectator',
      name: 'pong-spectator',
    });
    expect(JSON.parse(files.get('apps/spectator/package.json')!).devDependencies).toHaveProperty(
      '@nanoforge-dev/editor-lib',
      '^2.0.0',
    );
    const main = files.get('apps/spectator/src/main.ts')!;
    expect(main).toContain('import { EditorLibrary } from "@nanoforge-dev/editor-lib";');
    expect(main).toContain('  app.use(ecs);\n  app.use(new EditorLibrary());');
  });

  it('renames and removes an app, but never the last one', async () => {
    const { io, files, snapshot } = project();
    await renameApp(io, model(client, server), client, 'pong-game');
    expect(JSON.parse(files.get('apps/client/package.json')!).name).toBe('pong-game');
    await expect(renameApp(io, model(client, server), client, 'pong-server')).rejects.toThrow();

    const before = snapshot();
    const undo = await removeApp(io, model(client, server), server);
    expect(files.has('apps/server/src/main.ts')).toBe(false);
    await undo();
    expect(snapshot()).toEqual(before);
    await expect(removeApp(io, model(client), client)).rejects.toThrow(/at least one app/);
  });
});
