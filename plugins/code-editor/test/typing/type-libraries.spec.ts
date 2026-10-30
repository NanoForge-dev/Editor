import { describe, expect, it, vi } from 'vitest';

import type { ClientProject, CodeService } from '@nanoforge-dev/editor-sdk';

import type { Monaco } from '../../src/monaco/monaco';
import { TypeLibraries } from '../../src/typing/type-libraries';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
};

const setup = (count: number) => {
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
  } as unknown as ClientProject;
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
  } as unknown as Monaco;
  const types = deferred<{ path: string; text: string }[]>();
  const code = { typeFiles: () => types.promise } as unknown as CodeService;
  return { reads, added, libraries: new TypeLibraries(monaco, project, code), types };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('TypeLibraries', () => {
  it("adds none of the old project's files once disposed", async () => {
    const { reads, added, libraries } = setup(20);
    await settle();
    expect(reads.size).toBe(8);
    libraries.dispose();
    for (const read of reads.values()) read.resolve({ text: 'export const a = 1;\n' });
    await settle();
    expect(added).toEqual([]);
    expect(reads.size).toBe(8);
  });

  it('adds no package declarations that arrive after dispose', async () => {
    const { reads, added, libraries, types } = setup(1);
    await settle();
    reads.get('apps/client/src/file-0.ts')!.resolve({ text: "import { a } from 'speed';\n" });
    await settle();
    expect(added).toEqual(['file:///apps/client/src/file-0.ts']);
    libraries.dispose();
    types.resolve([{ path: 'node_modules/speed/index.d.ts', text: 'export declare const a: 1;' }]);
    await settle();
    expect(added).toEqual(['file:///apps/client/src/file-0.ts']);
  });
});
