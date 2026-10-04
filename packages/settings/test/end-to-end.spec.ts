import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MemoryContentCache, MemoryTreeCache, ProjectService } from '@nanoforge-dev/editor-project';
import { type EditorServer, createEditorServer, loadEnv } from '@nanoforge-dev/editor-server-core';
import { createLoopbackClient } from '@nanoforge-dev/editor-server-core/testing';

import {
  AccountSyncStore,
  CoreSettings,
  JsonFileScopeStore,
  MemoryKeyValueStore,
  PROJECT_LOCAL_SETTINGS_FILE,
  PROJECT_SETTINGS_FILE,
  SettingsRegistry,
  SettingsService,
  projectFileAdapter,
  rpcAccountRemote,
} from '../src';

let workspace: string;
let editor: EditorServer;

beforeAll(() => {
  workspace = mkdtempSync(join(import.meta.dirname, '../../server-core/test/.tmp-settings-'));
  cpSync(
    join(import.meta.dirname, '../../server-core/test/fixtures/pong-network'),
    join(workspace, 'pong'),
    {
      recursive: true,
    },
  );
  editor = createEditorServer({
    env: loadEnv(
      { NODE_ENV: 'test', FS_ROOT: workspace, DATA_DIR: mkdtempSync(join(tmpdir(), 'nf-data-')) },
      workspace,
    ),
    version: 'test',
  });
});

afterAll(() => {
  editor.dispose();
  rmSync(workspace, { recursive: true, force: true });
});

const client = async () => {
  const rpc = createLoopbackClient(editor);
  const registry = new SettingsRegistry();
  registry.register(...Object.values(CoreSettings));
  const settings = new SettingsService(registry);
  const remote = rpcAccountRemote(rpc);
  const account = new AccountSyncStore(remote, new MemoryKeyValueStore(), 'account', {
    debounceMs: 0,
  });
  remote.watch(() => void account.sync());
  await settings.setStore('account', account);
  return { rpc, settings, account };
};

describe('settings end to end', () => {
  it('syncs account settings between two clients', async () => {
    const a = await client();
    const b = await client();
    await a.settings.set(CoreSettings.historyLimit, 250, 'account');
    await a.account.sync();
    await new Promise((resolve) => setTimeout(resolve, 20)); // change stream → b pulls
    await b.account.sync();
    expect(b.settings.get(CoreSettings.historyLimit)).toBe(250);
    a.rpc.dispose();
    b.rpc.dispose();
  });

  it('stores project settings in the project and keeps local ones out of git', async () => {
    const { rpc, settings } = await client();
    const project = await new ProjectService(rpc, {
      contents: () => new MemoryContentCache(),
      tree: () => new MemoryTreeCache(),
    }).open({ path: 'pong' });
    await settings.setStore(
      'project',
      new JsonFileScopeStore(projectFileAdapter(project.fs, PROJECT_SETTINGS_FILE)),
    );
    await settings.setStore(
      'projectLocal',
      new JsonFileScopeStore(
        projectFileAdapter(project.fs, PROJECT_LOCAL_SETTINGS_FILE, { gitignored: true }),
      ),
    );

    await settings.set(CoreSettings.historyLimit, 50, 'project');
    await settings.set(CoreSettings.layoutActive, 'debug', 'projectLocal');
    const root = join(workspace, 'pong/.nanoforge/editor');
    expect(readFileSync(join(root, 'settings.json'), 'utf8')).toBe('{\n  "history.limit": 50\n}\n');
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain('local.json');
    expect(settings.inspect(CoreSettings.historyLimit).effectiveScope).toBe('project');
    rpc.dispose();
  });
});
