import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { MemoryScopeStore, SettingsRegistry, SettingsService, defineSetting } from '../../src';
import { colors, disabled, fontSize, tabSize, theme } from '../fixtures/settings';

const setup = async () => {
  const registry = new SettingsRegistry();
  registry.register(fontSize, theme, colors, disabled, tabSize);
  const warn = vi.fn();
  const service = new SettingsService(registry, { warn } as never);
  const stores = {
    account: new MemoryScopeStore(),
    machine: new MemoryScopeStore(),
    project: new MemoryScopeStore(),
    projectLocal: new MemoryScopeStore(),
  };
  for (const [scope, store] of Object.entries(stores))
    await service.setStore(scope as keyof typeof stores, store);
  return { registry, service, stores, warn };
};

describe('SettingsService', () => {
  it('applies scope precedence', async () => {
    const { service } = await setup();
    expect(service.get(fontSize)).toBe(13);
    await service.set(fontSize, 14, 'account');
    await service.set(fontSize, 15, 'project');
    expect(service.inspect(fontSize)).toMatchObject({
      value: 15,
      effectiveScope: 'project',
      scopes: { default: 13, account: 14, project: 15 },
    });
    await service.set(fontSize, 16, 'projectLocal');
    expect(service.get(fontSize)).toBe(16);
    await service.reset(fontSize, 'projectLocal');
    await service.reset(fontSize, 'project');
    expect(service.get(fontSize)).toBe(14);
  });

  it('merges deep and union settings across scopes', async () => {
    const { service } = await setup();
    await service.set(colors, { text: '#eee' }, 'account');
    await service.set(colors, { accent: '#f0f' }, 'project');
    expect(service.get(colors)).toEqual({ background: '#000', text: '#eee', accent: '#f0f' });
    await service.set(disabled, ['a/x', 'b/y'], 'account');
    await service.set(disabled, ['b/y', 'c/z'], 'project');
    expect(service.get(disabled)).toEqual(['a/x', 'b/y', 'c/z']);
  });

  it('restricts scopes on write and ignores values stored in forbidden scopes', async () => {
    const { service, stores, warn } = await setup();
    await expect(service.set(theme, 'light', 'project')).rejects.toThrow(
      /cannot be set at project level/,
    );
    await stores.project.write({ 'appearance.theme': 'evil' });
    expect(service.get(theme)).toBe('dark');
    expect(service.inspect(theme).ignored).toEqual([
      { scope: 'project', value: 'evil', reason: 'scope' },
    ]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('validates writes and ignores invalid stored values', async () => {
    const { service, stores } = await setup();
    await expect(service.set(fontSize, 2, 'account')).rejects.toThrow(/Invalid value/);
    await stores.machine.write({ 'editor.fontSize': 'huge' });
    await service.set(fontSize, 20, 'account');
    expect(service.get(fontSize)).toBe(20);
  });

  it('reads renamed settings and moves them on write', async () => {
    const { service, stores } = await setup();
    await stores.account.write({ 'editor.tabSize': 4 });
    expect(service.get(tabSize)).toBe(4);
    await service.set(tabSize, 8, 'account');
    expect(stores.account.values.get()).toEqual({ 'code.tabSize': 8 });
  });

  it('notifies observers only for relevant changes', async () => {
    const { service, stores } = await setup();
    const run = vi.fn();
    service.observe(fontSize).subscribe(run);
    await service.set(theme, 'light', 'machine');
    await service.set(fontSize, 18, 'machine');
    await stores.project.write({ 'editor.fontSize': 18 }); // same effective value
    expect(run.mock.calls).toEqual([[13], [18]]);
  });

  it('keeps the last value of an observed setting when its definition is removed', async () => {
    const { registry, service } = await setup();
    const zoom = defineSetting({ key: '@acme/plugin.zoom', schema: z.number(), default: 1 });
    const registration = registry.register(zoom);
    const run = vi.fn();
    service.observe(zoom).subscribe(run);
    expect(() => registration.dispose()).not.toThrow();
    registry.register(zoom);
    await service.set(zoom, 2, 'machine');
    expect(run.mock.calls).toEqual([[1], [2]]);
  });

  it('previews and applies imports', async () => {
    const { service } = await setup();
    await service.set(fontSize, 14, 'account');
    const preview = service.previewImport(
      'account',
      JSON.stringify({
        'editor.fontSize': 16,
        'appearance.theme': 'light',
        '@other/plugin.x': 1,
        'code.tabSize': 'no',
      }),
    );
    expect(preview).toMatchObject({
      changed: ['editor.fontSize'],
      added: ['appearance.theme'],
      unknown: ['@other/plugin.x'],
      rejected: [{ key: 'code.tabSize', reason: 'invalid value' }],
    });
    await service.applyImport(preview);
    expect(service.get(fontSize)).toBe(16);
    expect(JSON.parse(service.export('account'))).toEqual({
      'editor.fontSize': 16,
      'appearance.theme': 'light',
      '@other/plugin.x': 1,
    });
  });
});
