import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Container,
  ContextKeyService,
  CoreServices,
  ExtensionRegistry,
  ObservableValue,
} from '@nanoforge-dev/editor-kernel';
import { PROJECT_CHECKS, type ProjectSuggestion } from '@nanoforge-dev/editor-project';

import { AdoptionService } from '../../src/lib/adoption/adoption-service';

const suggestion = (id: string, files: string[] = ['a.ts']): ProjectSuggestion => ({
  id,
  title: id,
  detail: '',
  fix: {
    title: `Fix ${id}`,
    changeset: async () =>
      ({ label: id, files: files.map((path) => ({ path, before: '', after: 'x' })) }) as never,
  },
});

const setup = ({ apply = true, repository = false } = {}) => {
  const services = new Container('test');
  const extensions = new ExtensionRegistry();
  const contextKeys = new ContextKeyService();
  contextKeys.set('git.repository', repository);
  services.provide(CoreServices.Extensions, extensions);
  services.provide(CoreServices.ContextKeys, contextKeys);
  let onFiles: () => void = () => undefined;
  const project = {
    fs: {
      onDidChange: (listener: () => void) => {
        onFiles = listener;
        return { dispose: () => undefined };
      },
    },
  };
  const current = new ObservableValue<typeof project | undefined>(undefined);
  let dismissed: string[] = [];
  const settings = {
    get: () => dismissed,
    set: vi.fn(async (_key: unknown, value: string[]) => {
      dismissed = value;
    }),
  };
  const notify = vi.fn();
  const preview = vi.fn(async () => apply);
  const applyChangeset = vi.fn(async () => true);
  const warn = vi.fn();
  const service = new AdoptionService({
    services,
    projects: { current } as never,
    settings: settings as never,
    workspace: { applyChangeset } as never,
    previews: { preview } as never,
    notifications: { notify } as never,
    logger: { warn } as never,
  });
  const check = (id: string, run: () => Promise<ProjectSuggestion[]>) =>
    extensions.contribute(PROJECT_CHECKS, { id, run }, { owner: 'core' });
  return {
    service,
    current,
    project,
    check,
    settings,
    notify,
    preview,
    applyChangeset,
    warn,
    files: () => onFiles(),
  };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => vi.useRealTimers());

describe('AdoptionService', () => {
  it('runs every check when a project opens, without the dismissed ones nor failing checks', async () => {
    const { service, current, project, check, warn } = setup();
    check('one', async () => [suggestion('a'), suggestion('b')]);
    check('broken', async () => {
      throw new Error('boom');
    });
    current.set(project);
    await flush();
    expect(service.report.get().suggestions.map((item) => item.id)).toEqual(['a', 'b']);
    expect(warn).toHaveBeenCalledWith('The broken check failed', expect.any(Error));

    await service.dismiss(service.report.get().suggestions[0]!);
    expect(service.report.get().suggestions.map((item) => item.id)).toEqual(['b']);
    await service.refresh();
    expect(service.report.get().suggestions.map((item) => item.id)).toEqual(['b']);
    current.set(undefined);
    await flush();
    expect(service.report.get()).toEqual({ checking: false, suggestions: [] });
    service.dispose();
  });

  it('checks again a moment after files change', async () => {
    const { service, current, project, check, files } = setup();
    let count = 0;
    check('count', async () => [suggestion(`run-${++count}`)]);
    current.set(project);
    await flush();
    vi.useFakeTimers();
    files();
    files();
    await vi.advanceTimersByTimeAsync(1500);
    expect(service.report.get().suggestions.map((item) => item.id)).toEqual(['run-2']);
    service.dispose();
  });

  it('applies a fix only after its preview is accepted', async () => {
    const accepted = setup({ repository: true });
    expect(await accepted.service.fix(suggestion('a'))).toBe(true);
    expect(accepted.preview).toHaveBeenCalledWith(
      expect.objectContaining({ notes: [expect.stringMatching(/git repository/)] }),
    );
    expect(accepted.applyChangeset).toHaveBeenCalled();

    const refused = setup({ apply: false });
    expect(await refused.service.fix(suggestion('a'))).toBe(false);
    expect(refused.applyChangeset).not.toHaveBeenCalled();
  });

  it('says when a fix changes nothing, and when it cannot be made', async () => {
    const { service, notify } = setup();
    expect(await service.fix(suggestion('empty', []))).toBe(false);
    expect(notify).toHaveBeenCalledWith('info', 'Fix empty: nothing to change');
    expect(await service.fix({ ...suggestion('none'), fix: undefined })).toBe(false);
    const failing = {
      ...suggestion('bad'),
      fix: { title: 'Fix bad', changeset: async () => Promise.reject(new Error('no')) },
    };
    expect(await service.fix(failing as ProjectSuggestion)).toBe(false);
    expect(notify).toHaveBeenLastCalledWith('error', 'Fix bad: not possible', expect.anything());
  });
});
