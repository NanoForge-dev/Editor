import { describe, expect, it, vi } from 'vitest';

import { TypeLibraries } from '../../src/typing/type-libraries';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = (files: Record<string, string>) => {
  const libs = new Map<string, string>();
  const addExtraLib = (text: string, uri: string) => {
    libs.set(uri, text);
    return { dispose: () => libs.delete(uri) };
  };
  const monaco = {
    typescript: {
      typescriptDefaults: { addExtraLib },
      javascriptDefaults: { addExtraLib: () => ({ dispose: () => undefined }) },
    },
  };
  let onChange: (changes: { path: string; type: string }[]) => void = () => undefined;
  const project = {
    fs: {
      entries: Object.keys(files).map((path) => ({ path, kind: 'file' })),
      onDidChange: (listener: typeof onChange) => {
        onChange = listener;
        return { dispose: () => undefined };
      },
      readMany: vi.fn(async () => undefined),
      readText: async (path: string) => ({ text: files[path] }),
    },
    model: { get: () => ({ apps: [{ root: 'apps/client' }, { root: 'apps/server' }] }) },
  };
  const typeFiles = vi.fn(async (module: string) => [
    { path: `node_modules/${module}/index.d.ts`, text: `declare module '${module}';` },
  ]);
  const libraries = new TypeLibraries(monaco as never, project as never, { typeFiles } as never);
  return {
    libraries,
    libs,
    typeFiles,
    change: (path: string, type: string) => onChange([{ path, type }]),
  };
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
};

/** Reads held until the test answers them, to dispose while a load is on its way. */
const setupHeld = (count: number) => {
  const reads = new Map<string, ReturnType<typeof deferred<{ text: string }>>>();
  const paths = Array.from({ length: count }, (_, index) => `apps/client/src/file-${index}.ts`);
  const project = {
    fs: {
      entries: paths.map((path) => ({ kind: 'file', path })),
      onDidChange: () => ({ dispose: () => undefined }),
      readMany: async () => undefined,
      readText: (path: string) => {
        const read = deferred<{ text: string }>();
        reads.set(path, read);
        return read.promise;
      },
    },
    model: { get: () => ({ apps: [{ root: 'apps/client' }] }) },
  };
  const added: string[] = [];
  const addExtraLib = vi.fn((_text: string, uri: string) => {
    added.push(uri);
    return { dispose: () => undefined };
  });
  const monaco = {
    typescript: {
      typescriptDefaults: { addExtraLib },
      javascriptDefaults: { addExtraLib: () => ({ dispose: () => undefined }) },
    },
  };
  const types = deferred<{ path: string; text: string }[]>();
  const code = { typeFiles: () => types.promise };
  return {
    reads,
    added,
    libraries: new TypeLibraries(monaco as never, project as never, code as never),
    types,
  };
};

describe('TypeLibraries', () => {
  it("gives Monaco the project's code files and the declarations they import, once per app", async () => {
    const { libs, typeFiles } = setup({
      'apps/client/src/main.ts': `import { a } from '@nanoforge-dev/core/client';\nimport fs from 'node:fs';`,
      'apps/client/src/b.ts': `const x = await import('@nanoforge-dev/core');`,
      'apps/server/src/main.ts': `import { b } from "@nanoforge-dev/core"; import './local';`,
      'apps/client/node_modules/x/index.ts': 'ignored',
      'apps/client/README.md': 'not code',
    });
    await flush();
    await flush();
    expect([...libs.keys()].sort()).toEqual([
      'file:///apps/client/src/b.ts',
      'file:///apps/client/src/main.ts',
      'file:///apps/server/src/main.ts',
      'file:///node_modules/@nanoforge-dev/core/index.d.ts',
    ]);
    expect(
      typeFiles.mock.calls.map(([module, from]) => `${module} ${from.split('/')[1]}`).sort(),
    ).toEqual(['@nanoforge-dev/core client', '@nanoforge-dev/core server']);
  });

  it('leaves a file open in an editor to its model, and follows changes on disk', async () => {
    const { libraries, libs, change } = setup({ 'src/a.ts': 'export const a = 1;' });
    await flush();
    libraries.modelOpened('src/a.ts');
    expect(libs.has('file:///src/a.ts')).toBe(false);
    change('src/a.ts', 'changed');
    await flush();
    expect(libs.has('file:///src/a.ts')).toBe(false);
    libraries.modelClosed('src/a.ts');
    await flush();
    expect(libs.has('file:///src/a.ts')).toBe(true);
    change('src/a.ts', 'deleted');
    expect(libs.has('file:///src/a.ts')).toBe(false);
    libraries.dispose();
  });

  it('keeps declaration texts for read-only tabs', async () => {
    const { libraries } = setup({ 'src/a.ts': `import 'pkg';` });
    await flush();
    await flush();
    expect(libraries.library('node_modules/pkg/index.d.ts')).toBe("declare module 'pkg';");
    expect(libraries.library('nope.d.ts')).toBeUndefined();
  });

  it("adds none of the old project's files once disposed", async () => {
    const { reads, added, libraries } = setupHeld(20);
    await flush();
    expect(reads.size).toBe(8);
    libraries.dispose();
    for (const read of reads.values()) read.resolve({ text: 'export const a = 1;\n' });
    await flush();
    expect(added).toEqual([]);
    expect(reads.size).toBe(8);
  });

  it('adds no package declarations that arrive after dispose', async () => {
    const { reads, added, libraries, types } = setupHeld(1);
    await flush();
    reads.get('apps/client/src/file-0.ts')!.resolve({ text: "import { a } from 'speed';\n" });
    await flush();
    expect(added).toEqual(['file:///apps/client/src/file-0.ts']);
    libraries.dispose();
    types.resolve([{ path: 'node_modules/speed/index.d.ts', text: 'export declare const a: 1;' }]);
    await flush();
    expect(added).toEqual(['file:///apps/client/src/file-0.ts']);
  });
});
