import { afterEach, describe, expect, it, vi } from 'vitest';

import { CodeEditorService } from '../../src/service/code-editor-service';
import { SETTING } from '../../src/service/code-editor-settings.const';
import { fakeMonaco } from '../fixtures/fake-monaco';

vi.mock('../../src/monaco/monaco', () => ({
  uriOf: (path: string) => path,
  pathOf: (uri: string) => uri,
}));
vi.mock('@nanoforge-dev/editor-sdk/ui', () => ({
  notifyError: vi.fn(),
  parseColor: () => [0, 0, 0, 1],
  toHex: () => '#000000',
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = (settings: Record<string, unknown> = {}) => {
  const disk = new Map([
    ['src/a.ts', { text: 'a', hash: 'a0' }],
    ['src/b.ts', { text: 'b', hash: 'b0' }],
  ]);
  const monaco = fakeMonaco();
  let onChange: (changes: { path: string; type: string }[]) => void = () => undefined;
  const register = vi.fn(() => ({ dispose: () => undefined }));
  const backend = {
    read: async (path: string) => disk.get(path)!,
    write: async (path: string, text: string) => {
      const hash = `${path}:${text}`;
      disk.set(path, { text, hash });
      return { hash };
    },
  };
  const service = new CodeEditorService({
    monaco: monaco as never,
    project: {
      id: `p${Math.random()}`,
      fs: {
        entries: [],
        entry: (path: string) => (disk.has(path) ? { path, kind: 'file' } : undefined),
        onDidChange: (listener: typeof onChange) => {
          onChange = listener;
          return { dispose: () => undefined };
        },
        readMany: async () => undefined,
        readText: async (path: string) => ({ text: disk.get(path)?.text }),
      },
      model: { get: () => ({ apps: [] }) },
    } as never,
    documents: { backend, register, historyContext: vi.fn(), saveAll: async () => [] } as never,
    code: undefined,
    diagnostics: undefined,
    settings: {
      get: (key: string) => settings[key],
      observe: () => ({ get: () => undefined, subscribe: () => () => undefined }),
    } as never,
    notifications: undefined,
    logger: { warn: vi.fn(), error: vi.fn() } as never,
  });
  return {
    service,
    monaco,
    disk,
    register,
    change: (path: string, type: string) => onChange([{ path, type }]),
  };
};

afterEach(() => vi.useRealTimers());

describe('CodeEditorService', () => {
  it('opens files as tabs of the focused group, once each', async () => {
    const { service, register } = setup();
    await service.open('src/a.ts');
    await service.open('src/b.ts');
    await service.open('src/a.ts');
    expect(service.layout.get()).toEqual({
      groups: [{ tabs: ['src/a.ts', 'src/b.ts'], active: 'src/a.ts' }],
      focused: 0,
    });
    expect(register).toHaveBeenCalledTimes(2);
    expect(service.activePath()).toBe('src/a.ts');
  });

  it('splits to the right, and drops a group once its last tab closes', async () => {
    const { service } = setup();
    await service.open('src/a.ts');
    service.splitRight();
    expect(service.layout.get().groups).toEqual([
      { tabs: ['src/a.ts'], active: 'src/a.ts' },
      { tabs: ['src/a.ts'], active: 'src/a.ts' },
    ]);
    await service.open('src/b.ts', { group: 1, line: 3 });
    expect(service.takeReveal(1, 'src/b.ts')).toEqual({
      group: 1,
      path: 'src/b.ts',
      line: 3,
      column: 1,
    });
    expect(service.takeReveal(1, 'src/b.ts')).toBeUndefined();
    service.close(1, 'src/a.ts');
    service.close(1, 'src/b.ts');
    expect(service.layout.get()).toEqual({
      groups: [{ tabs: ['src/a.ts'], active: 'src/a.ts' }],
      focused: 0,
    });
    expect(service.document('src/b.ts')).toBeUndefined();
    expect(service.document('src/a.ts')).toBeDefined();
  });

  it('asks before closing unsaved changes: cancel keeps, discard reverts, save writes', async () => {
    const { service, monaco, disk } = setup();
    await service.open('src/a.ts');
    monaco.models.get('src/a.ts')!.type('!');
    service.requestClose(0, 'src/a.ts');
    expect(service.closing.get()).toEqual({ group: 0, path: 'src/a.ts' });
    await service.finishClose('cancel');
    expect(service.activePath()).toBe('src/a.ts');

    service.requestClose(0, 'src/a.ts');
    await service.finishClose('save');
    expect(disk.get('src/a.ts')?.text).toBe('a!');
    expect(service.activePath()).toBeUndefined();

    await service.open('src/b.ts');
    monaco.models.get('src/b.ts')!.type('?');
    service.requestClose(0, 'src/b.ts');
    await service.finishClose('discard');
    expect(disk.get('src/b.ts')?.text).toBe('b');
    expect(service.layout.get().groups[0]?.tabs).toEqual([]);
  });

  it('closes a clean file deleted on disk, and keeps an unsaved one in conflict', async () => {
    const { service, monaco, change } = setup();
    await service.open('src/a.ts');
    await service.open('src/b.ts');
    monaco.models.get('src/b.ts')!.type('?');
    change('src/a.ts', 'deleted');
    change('src/b.ts', 'deleted');
    await flush();
    expect(service.layout.get().groups[0]?.tabs).toEqual(['src/b.ts']);
    expect(service.document('src/b.ts')?.conflict.get()).toEqual({
      diskText: null,
      diskHash: null,
    });
  });

  it('shows a file next to another text until the comparison or the tab closes', async () => {
    const { service } = setup();
    await service.compare('src/a.ts', { text: 'old', label: 'Last commit' });
    expect(service.comparisons.get().get('src/a.ts')?.label).toBe('Last commit');
    service.closeComparison('src/a.ts');
    expect(service.comparisons.get().size).toBe(0);
    await service.compare('src/a.ts', { text: 'old', label: 'Last commit' });
    service.close(0, 'src/a.ts');
    expect(service.comparisons.get().size).toBe(0);
  });

  it('saves after a delay when autosave is on, and on focus loss when asked', async () => {
    const { service, monaco, disk } = setup({
      [SETTING.autoSaveAfterDelay]: true,
      [SETTING.autoSaveDelayMs]: 1000,
      [SETTING.autoSaveOnFocusLoss]: true,
    });
    await service.open('src/a.ts');
    await service.open('src/b.ts');
    vi.useFakeTimers();
    monaco.models.get('src/a.ts')!.type('1');
    await vi.advanceTimersByTimeAsync(999);
    expect(disk.get('src/a.ts')?.text).toBe('a');
    await vi.advanceTimersByTimeAsync(1);
    expect(disk.get('src/a.ts')?.text).toBe('a1');
    vi.useRealTimers();
    monaco.models.get('src/b.ts')!.type('2');
    service.focusLost();
    await flush();
    await flush();
    expect(disk.get('src/b.ts')?.text).toBe('b2');
  });

  it('restores the tabs of files that still exist', async () => {
    const { service } = setup();
    await service.restore({
      groups: [
        { tabs: ['src/gone.ts', 'src/b.ts'], active: 'src/gone.ts' },
        { tabs: ['src/a.ts'], active: 'src/a.ts' },
        { tabs: ['src/c.ts'], active: undefined },
      ],
      focused: 4,
    });
    expect(service.layout.get()).toEqual({
      groups: [
        { tabs: ['src/b.ts'], active: 'src/b.ts' },
        { tabs: ['src/a.ts'], active: 'src/a.ts' },
      ],
      focused: 1,
    });
    expect(service.document('src/a.ts')).toBeDefined();
  });

  it("follows the theme's code colors, and remeasures only when the code font changes", () => {
    const { service, monaco } = setup();
    const theme = { id: 't', label: 'T', kind: 'dark', colors: {} } as never;
    service.applyTheme(theme);
    service.applyTheme({ ...(theme as object), tokens: { 'font-code': 'Mono' } } as never);
    service.applyTheme({ ...(theme as object), tokens: { 'font-code': 'Mono' } } as never);
    expect(monaco.editor.setTheme).toHaveBeenCalledTimes(3);
    expect(monaco.editor.remeasureFonts).toHaveBeenCalledTimes(1);
  });
});
