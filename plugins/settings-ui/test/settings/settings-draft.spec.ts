import { describe, expect, it, vi } from 'vitest';

import type { SettingDefinition, WritableScope } from '@nanoforge-dev/editor-sdk';

import { SettingsDraft } from '../../src/settings/settings-draft';

const disabled = {
  key: 'plugins.disabled',
  default: [],
  mergeStrategy: 'union',
  scopes: ['account', 'machine', 'project', 'projectLocal'],
} as unknown as SettingDefinition;

/** A settings service holding one setting's value per scope. */
const settingsWith = (values: Partial<Record<WritableScope, string[]>>) => ({
  inspect: () => ({ scopes: values, effectiveScope: 'account' }),
  get: () => [...new Set(Object.values(values).flat())],
  hasStore: () => true,
  set: vi.fn(async (_key: string, value: string[], scope: WritableScope) => {
    values[scope] = value;
  }),
  reset: vi.fn(),
});

describe('SettingsDraft', () => {
  it('keeps a pending change per scope and merges them like the settings service', async () => {
    const settings = settingsWith({ account: ['a'], project: ['b'] });
    const draft = new SettingsDraft(settings as never);
    expect(draft.valueOf(disabled)).toEqual(['a', 'b']);

    draft.setIn(disabled, [], 'project');
    draft.setIn(disabled, ['a', 'c'], 'account');
    expect(draft.valueOf(disabled)).toEqual(['a', 'c']);
    expect(draft.scopeValue(disabled, 'project')).toEqual([]);
    expect(draft.changes.get().get('plugins.disabled')?.size).toBe(2);

    expect(await draft.apply()).toEqual([]);
    expect(settings.set).toHaveBeenCalledWith('plugins.disabled', [], 'project');
    expect(settings.set).toHaveBeenCalledWith('plugins.disabled', ['a', 'c'], 'account');
    expect(draft.changes.get().size).toBe(0);
  });

  it('moves a pending value with the target scope', () => {
    const draft = new SettingsDraft(settingsWith({ account: ['a'] }) as never);
    draft.set(disabled, ['a', 'b']);
    draft.setScope(disabled, 'machine');
    const changes = draft.changes.get().get('plugins.disabled')!;
    expect([...changes.keys()]).toEqual(['machine']);
    expect(draft.valueOf(disabled)).toEqual(['a', 'b']);
  });
});
