import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/workspace/app-operations';
import { applyChangeset, recordChanges } from '../../src/workspace/changeset';
import { client, model, project, server } from '../fixtures/workspace';

const newApp = { type: 'client', folder: 'spectator', name: 'pong-spectator' } as const;

describe('changesets', () => {
  it('records what an operation would change, writes nothing, and applies the same result', async () => {
    const direct = project();
    await createApp(direct.io, model(client, server), newApp);

    const { io, files, snapshot } = project();
    const before = snapshot();
    const changeset = await recordChanges(io, 'Add spectator', (memory) =>
      createApp(memory, model(client, server), newApp),
    );
    expect(snapshot()).toEqual(before);
    expect(changeset.files.map((file) => file.path)).toContain('apps/spectator/src/main.ts');
    expect(changeset.files.every((file) => file.before === undefined)).toBe(true);

    const undo = await applyChangeset(io, changeset);
    expect(snapshot()).toEqual(direct.snapshot());
    expect(files.get('apps/spectator/package.json')).toBeDefined();
    await undo();
    expect(snapshot()).toEqual(before);
    expect(io.exists('apps/spectator')).toBe(false);
  });

  it('records edits and removals, and refuses files changed since the preview', async () => {
    const { io, files, snapshot } = project();
    const changeset = await recordChanges(io, 'Edit', async (memory) => {
      await memory.write('apps/client/src/main.ts', 'export const main = 3;\n');
      await memory.remove('apps/server');
      await memory.write('apps/client/src/main.ts', 'export const main = 4;\n');
    });
    expect(changeset.files).toContainEqual({
      path: 'apps/client/src/main.ts',
      before: 'export const main = 1;\n',
      after: 'export const main = 4;\n',
    });
    expect(changeset.files.find((file) => file.path === 'apps/server/src/main.ts')).toEqual({
      path: 'apps/server/src/main.ts',
      before: 'export const main = 2;\n',
    });

    files.set('apps/client/src/main.ts', 'export const main = 9;\n');
    const before = snapshot();
    await expect(applyChangeset(io, changeset)).rejects.toThrow('changed since the preview');
    expect(snapshot()).toEqual(before);
  });
});
