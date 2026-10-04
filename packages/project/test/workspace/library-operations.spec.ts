import { describe, expect, it } from 'vitest';

import { withConfigLibrary } from '../../src/workspace/library-config';
import {
  createLibrary,
  libraryImporters,
  removeLibrary,
  renameLibrary,
  setLibraryUse,
  withRenamedImports,
} from '../../src/workspace/library-operations';
import { WorkspaceError } from '../../src/workspace/workspace.exception';
import { app, client, model, project, server, shared } from '../fixtures/workspace';

describe('shared libraries', () => {
  it('creates a library used by the chosen apps, and undoes it', async () => {
    const { io, files, snapshot } = project();
    const before = snapshot();
    const undo = await createLibrary(io, {
      folder: 'shared',
      packageName: '@pong/shared',
      usedBy: [client, server],
    });
    expect(JSON.parse(files.get('libs/shared/package.json')!)).toMatchObject({
      name: '@pong/shared',
      private: true,
    });
    expect(files.get('libs/shared/nanoforge.config.ts')).toContain('type: "lib"');
    expect(files.get('nanoforge.config.ts')).toContain('packages: ["apps/*", "libs/*"]');
    expect(files.get('tsconfig.json')).toContain('// shared options');
    expect(files.get('tsconfig.json')).toContain('"@pong/shared/*": ["./libs/shared/src/*"]');
    for (const path of ['apps/client/package.json', 'apps/server/package.json'])
      expect(JSON.parse(files.get(path)!).dependencies).toEqual({ '@pong/shared': 'workspace:*' });
    expect(files.get('apps/client/nanoforge.config.ts')).toContain(
      '  type: "client",\n  libs: ["../../libs/shared"],\n',
    );
    expect(files.get('apps/server/nanoforge.config.ts')).toBe(
      "export default { type: 'server', libs: ['../../libs/shared'] };\n",
    );

    await undo();
    expect(snapshot()).toEqual(before);

    await expect(
      createLibrary(io, { folder: 'Bad Name', packageName: '@pong/shared', usedBy: [] }),
    ).rejects.toBeInstanceOf(WorkspaceError);
    await expect(
      createLibrary(io, { folder: 'ok', packageName: 'Not A Name', usedBy: [] }),
    ).rejects.toThrow(/package name/);
    expect(snapshot()).toEqual(before);
  });

  it('adds and removes the use of a library by an app', async () => {
    const { io, files } = project();
    await createLibrary(io, { folder: 'shared', packageName: '@pong/shared', usedBy: [client] });
    expect(JSON.parse(files.get('apps/server/package.json')!).dependencies).toBeUndefined();

    const undo = await setLibraryUse(io, server, shared, true);
    expect(JSON.parse(files.get('apps/server/package.json')!).dependencies).toEqual({
      '@pong/shared': 'workspace:*',
    });
    expect(files.get('apps/server/nanoforge.config.ts')).toContain("libs: ['../../libs/shared']");
    await undo();
    expect(files.get('apps/server/nanoforge.config.ts')).toContain('libs: []');
    expect(JSON.parse(files.get('apps/server/package.json')!).dependencies).toBeUndefined();

    await setLibraryUse(io, client, shared, false);
    const pkg = JSON.parse(files.get('apps/client/package.json')!);
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.devDependencies).toHaveProperty('typescript');
    expect(files.get('apps/client/nanoforge.config.ts')).toContain('  libs: [],\n');
  });

  it("edits a config's libs in place, by the folder each entry points at", () => {
    const config =
      'export default defineConfig({\n  type: "client",\n  entryFile: "src/main.ts",\n});\n';
    const added = withConfigLibrary(config, 'apps/client', 'libs/shared', true)!;
    expect(added).toBe(
      'export default defineConfig({\n  type: "client",\n  libs: ["../../libs/shared"],\n  entryFile: "src/main.ts",\n});\n',
    );
    const other = added.replace('"../../libs/shared"', '"./../../libs/shared/"');
    expect(withConfigLibrary(other, 'apps/client', 'libs/shared', true)).toBe(other);
    expect(withConfigLibrary(added, 'apps/client', 'libs/ui', true)).toContain(
      'libs: ["../../libs/shared", "../../libs/ui"],',
    );
    expect(withConfigLibrary(other, 'apps/client', 'libs/shared', false)).toContain('libs: [],');
    expect(
      withConfigLibrary("export default { type: 'server' };\n", 'apps/server', 'libs/a', true),
    ).toBe("export default { type: 'server', libs: ['../../libs/a'] };\n");
    expect(withConfigLibrary('export default config;\n', 'apps/x', 'libs/a', true)).toBeUndefined();
    expect(withConfigLibrary(config, 'apps/client', 'libs/shared', false)).toBe(config);
  });

  it('renames a library: package, paths, dependencies and imports', async () => {
    const { io, files, snapshot } = project();
    await createLibrary(io, { folder: 'shared', packageName: '@pong/shared', usedBy: [client] });
    files.set(
      'apps/client/src/main.ts',
      'import { Position } from "@pong/shared/components/position";\nexport * from \'@pong/shared/systems/move\';\nconst lazy = import("@pong/shared/later");\nimport other from "@pong/shared-tools";\n',
    );
    const before = snapshot();
    const library = app('libs/shared', '@pong/shared', 'lib');
    const all = model(client, server, library);

    const undo = await renameLibrary(io, all, library, '@pong/common');
    expect(JSON.parse(files.get('libs/shared/package.json')!).name).toBe('@pong/common');
    const tsconfig = files.get('tsconfig.json')!;
    expect(tsconfig).toContain('"@pong/common/*": ["./libs/shared/src/*"]');
    expect(tsconfig).not.toContain('@pong/shared/');
    expect(JSON.parse(files.get('apps/client/package.json')!).dependencies).toEqual({
      '@pong/common': 'workspace:*',
    });
    expect(files.get('apps/client/src/main.ts')).toBe(
      'import { Position } from "@pong/common/components/position";\nexport * from \'@pong/common/systems/move\';\nconst lazy = import("@pong/common/later");\nimport other from "@pong/shared-tools";\n',
    );
    await undo();
    expect(snapshot()).toEqual(before);

    await expect(renameLibrary(io, all, library, 'pong-client')).rejects.toThrow(/already/);
    expect(withRenamedImports('const a = 1;', '@pong/shared', '@x/y')).toBeUndefined();
  });

  it('refuses to remove a library that is imported, then removes it', async () => {
    const { io, files, snapshot } = project();
    await createLibrary(io, { folder: 'shared', packageName: '@pong/shared', usedBy: [client] });
    files.set('libs/shared/src/components/position.ts', 'export class Position {}\n');
    files.set(
      'apps/client/src/main.ts',
      'import { Position } from "@pong/shared/components/position";\n',
    );
    const library = app('libs/shared', '@pong/shared', 'lib');
    const all = model(client, server, library);

    expect(await libraryImporters(io, library)).toEqual(['apps/client/src/main.ts']);
    const refused = await removeLibrary(io, all, library).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(WorkspaceError);
    expect((refused as WorkspaceError).paths).toEqual(['apps/client/src/main.ts']);
    expect(files.has('libs/shared/package.json')).toBe(true);

    files.set('apps/client/src/main.ts', 'export const main = 1;\n');
    const before = snapshot();
    const undo = await removeLibrary(io, all, library);
    expect([...files.keys()].some((path) => path.startsWith('libs/shared/'))).toBe(false);
    expect(files.get('tsconfig.json')).not.toContain('@pong/shared');
    expect(files.get('apps/client/nanoforge.config.ts')).toContain('libs: [],');
    expect(JSON.parse(files.get('apps/client/package.json')!).dependencies).toBeUndefined();
    await undo();
    expect(snapshot()).toEqual(before);
  });
});
