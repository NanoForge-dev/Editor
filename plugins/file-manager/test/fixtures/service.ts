import { vi } from 'vitest';

import type { ContextKeyService, ExtensionPoint, FileEntry } from '@nanoforge-dev/editor-sdk';

import { FileManagerService } from '../../src/service/file-manager-service';

/** Context keys reading `key == value` clauses: what the menu's `when` tests use. */
const contextKeys = () =>
  ({
    createScoped: () => {
      const values = new Map<string, unknown>();
      return {
        set: (key: string, value: unknown) => values.set(key, value),
        dispose: () => values.clear(),
        evaluate: (when: string | undefined) => {
          if (!when) return true;
          const [key, value] = when.split('==').map((part) => part.trim().replace(/^'|'$/g, ''));
          return String(values.get(key!)) === value;
        },
      };
    },
  }) as unknown as ContextKeyService;

const dirname = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/**
 * A file manager on a project of a few entries; its operations, prompts and commands are mocks.
 * Tests that import it mock `@nanoforge-dev/editor-sdk/ui` (its Svelte components).
 */
export const makeService = (
  entries: FileEntry[] = [
    { path: 'src', kind: 'directory' },
    { path: 'src/main.ts', kind: 'file' },
    { path: 'nf_modules', kind: 'directory' },
    { path: 'nf_modules/ball.ts', kind: 'file' },
  ] as FileEntry[],
  values: Record<string, unknown[]> = {},
  { local = true, apps = [] as { root: string; type: string }[] } = {},
) => {
  const keys = contextKeys();
  const executeCommand = vi.fn(async () => undefined);
  const ask = vi.fn<(options: { validate?: (value: string) => string | undefined }) => Promise<string | undefined>>(
    async () => undefined,
  );
  const notify = vi.fn();
  const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
  const service = new FileManagerService({
    project: {
      id: 'p1',
      model: { get: () => ({ apps }) },
      fs: {
        entry: (path: string) => entries.find((entry) => entry.path === path),
        children: (path: string) => entries.filter((entry) => dirname(entry.path) === path),
        reveal: vi.fn(async () => undefined),
      },
    } as never,
    history: { dispose: vi.fn() } as never,
    extensions: {
      getValues: <T>(point: ExtensionPoint<T>) => (values[point.id] ?? []) as T[],
    },
    contextKeys: keys,
    prompts: { ask } as never,
    notifications: { notify } as never,
    executeCommand,
    logger: logger as never,
    local,
  });
  for (const method of [
    'createFile',
    'createFolder',
    'createFromTemplate',
    'rename',
    'move',
    'copy',
    'duplicate',
    'delete',
    'import',
  ] as const)
    vi.spyOn(service.operations, method).mockImplementation(async () => [] as never);
  return { service, executeCommand, ask, notify, logger, contextKeys: keys };
};
