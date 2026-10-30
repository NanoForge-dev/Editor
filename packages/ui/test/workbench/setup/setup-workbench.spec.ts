import { describe, expect, it } from 'vitest';

import { HistoryService } from '@nanoforge-dev/editor-history';
import {
  CommandRegistry,
  Container,
  ContextKeyService,
  ExtensionRegistry,
} from '@nanoforge-dev/editor-kernel';
import { emptyLayout } from '@nanoforge-dev/editor-layout';
import {
  CoreSettings,
  MemoryScopeStore,
  SettingsRegistry,
  SettingsService,
} from '@nanoforge-dev/editor-settings';

import { NotificationService } from '../../../src/workbench/notification/notification-service';
import { setupWorkbench } from '../../../src/workbench/setup/setup-workbench';

const settingsWith = async (stores: { account?: MemoryScopeStore; machine?: MemoryScopeStore }) => {
  const registry = new SettingsRegistry();
  registry.register(...Object.values(CoreSettings));
  const settings = new SettingsService(registry);
  const projectLocal = new MemoryScopeStore();
  await settings.setStore('projectLocal', projectLocal);
  for (const [scope, store] of Object.entries(stores))
    await settings.setStore(scope as 'account' | 'machine', store);
  return { settings, projectLocal };
};

const open = (settings: SettingsService, knownUser?: boolean) => {
  const contextKeys = new ContextKeyService();
  return setupWorkbench({
    shell: { notifications: new NotificationService(), styles: {}, prompts: {} } as never,
    services: {} as never,
    extensions: new ExtensionRegistry(),
    commands: new CommandRegistry(new Container(), contextKeys),
    contextKeys,
    settings,
    history: new HistoryService(),
    logger: { warn: () => undefined, error: () => undefined } as never,
    activate: async () => undefined,
    ...(knownUser !== undefined && { knownUser }),
  });
};

const preset = (store: MemoryScopeStore) => store.values.get()[CoreSettings.layoutPreset.key];

describe('setupWorkbench default layout', () => {
  it('keeps every panel for someone with a saved layout and no default chosen', async () => {
    const account = new MemoryScopeStore();
    const { settings } = await settingsWith({ account });
    await settings.set(CoreSettings.layoutSaved, { default: emptyLayout() }, 'projectLocal');
    const workbench = open(settings);
    expect(workbench.layout.firstRun).toBe(false);
    await expect.poll(() => preset(account)).toBe('full');
    workbench.dispose();
  });

  it('starts a new user with the main panels and writes it', async () => {
    const account = new MemoryScopeStore();
    const { settings } = await settingsWith({ account });
    const workbench = open(settings);
    expect(workbench.layout.firstRun).toBe(true);
    await expect.poll(() => preset(account)).toBe('simple');
    workbench.dispose();
  });

  it('keeps a new user on the main panels once their layout is saved', async () => {
    const account = new MemoryScopeStore();
    const { settings, projectLocal } = await settingsWith({ account });
    const first = open(settings);
    await expect.poll(() => preset(account)).toBe('simple');
    await first.layout.apply({ type: 'resizeSlot', slot: 'bottom', size: 320 });
    first.dispose();
    await expect.poll(() => projectLocal.values.get()[CoreSettings.layoutSaved.key]).toBeDefined();

    const second = open(settings);
    expect(second.layout.firstRun).toBe(false);
    await Promise.resolve();
    expect(preset(account)).toBe('simple');
    expect(settings.get(CoreSettings.layoutPreset)).toBe('simple');
    second.dispose();
  });

  it('keeps every panel for someone who worked in other projects', async () => {
    const account = new MemoryScopeStore();
    const { settings } = await settingsWith({ account });
    const workbench = open(settings, true);
    await expect.poll(() => preset(account)).toBe('full');
    workbench.dispose();
  });

  it('switches the default layout in the scope that holds it', async () => {
    const account = new MemoryScopeStore();
    const machine = new MemoryScopeStore({ [CoreSettings.layoutPreset.key]: 'full' });
    const { settings } = await settingsWith({ account, machine });
    const workbench = open(settings);
    await workbench.commands.execute('layout.simple');
    expect(preset(machine)).toBe('simple');
    expect(preset(account)).toBeUndefined();
    expect(settings.get(CoreSettings.layoutPreset)).toBe('simple');
    workbench.dispose();
  });
});
