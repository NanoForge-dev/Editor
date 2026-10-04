import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ItemOwner } from '@nanoforge-dev/editor-meta';
import {
  type ClientProject,
  MemoryContentCache,
  MemoryTreeCache,
  ProjectService,
} from '@nanoforge-dev/editor-project';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';
import { type EditorServer, createEditorServer, loadEnv } from '@nanoforge-dev/editor-server-core';
import { createLoopbackClient } from '@nanoforge-dev/editor-server-core/testing';

import {
  CatalogService,
  CodeService,
  DiagnosticsService,
  DocumentService,
  type WorkerPluginModule,
  projectFsBackend,
} from '../../src';
import { serveEngine } from '../../src/worker-rpc/serve-engine';

const owner: ItemOwner = {
  name: '@nanoforge/ecs',
  version: '1.0.0',
  schema: 1,
  tags: ['component'],
  infer: ({ context, kind }) => context.folder === 'components' && kind === 'class',
  claims: () => ({ fields: ['name'] }),
  extract: ({ declaration }) => ({ type: 'component', name: declaration.getName() }),
};
const ecsPlugin: WorkerPluginModule = { activate: (sdk) => void sdk.registerItemOwner(owner) };

let workspace: string;
let editor: EditorServer;
let rpc: RpcClient;
let project: ClientProject;

const write = (path: string, text: string) => {
  const file = join(workspace, 'pong', path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};

const setup = async () => {
  const documents = new DocumentService(projectFsBackend(project.fs));
  const code = new CodeService({
    projectId: project.id,
    fs: project.fs,
    rpc,
    documents,
    diagnostics: new DiagnosticsService(),
    createWorker: () => {
      const channel = new MessageChannel();
      serveEngine(channel.port2 as never, { importModule: async () => ecsPlugin });
      return channel.port1 as never;
    },
  });
  await code.loadWorkerPlugin('@nanoforge/ecs', 'memory://ecs');
  const catalog = new CatalogService({ project, code, documents, delayMs: 10 });
  return { code, catalog };
};

beforeAll(async () => {
  workspace = mkdtempSync(join(import.meta.dirname, '../../../server-core/test/.tmp-catalog-'));
  cpSync(
    join(import.meta.dirname, '../../../server-core/test/fixtures/pong-network'),
    join(workspace, 'pong'),
    { recursive: true },
  );
  write(
    'nf_modules/@nanoforge/motion/nanoforge.manifest.json',
    JSON.stringify({
      type: 'package',
      name: '@nanoforge/motion',
      version: '0.1.0',
      items: ['velocity.ts'],
    }),
  );
  write(
    'nf_modules/@nanoforge/motion/velocity.ts',
    '/** Speed. @component @side shared */\nexport class Velocity { name = "Velocity"; constructor(public x = 0) {} }',
  );
  editor = createEditorServer({
    env: loadEnv(
      { NODE_ENV: 'test', FS_ROOT: workspace, DATA_DIR: mkdtempSync(join(tmpdir(), 'nf-data-')) },
      workspace,
    ),
    version: 'test',
  });
  rpc = createLoopbackClient(editor);
  project = await new ProjectService(rpc, {
    contents: () => new MemoryContentCache(),
    tree: () => new MemoryTreeCache(),
  }).open({ path: 'pong' });
});

afterAll(() => {
  rpc.dispose();
  editor.dispose();
  rmSync(workspace, { recursive: true, force: true });
});

describe('CatalogService', () => {
  it('lists app components (inferred) and installed package items, and caches them', async () => {
    const { code, catalog } = await setup();
    await catalog.refresh();
    const refs = catalog.items.map((item) => item.ref);
    expect(refs).toContain('app:client#Position');
    expect(refs).toContain('@nanoforge/motion#Velocity');
    expect(catalog.get('@nanoforge/motion#Velocity')).toMatchObject({
      readonly: true,
      meta: { params: [{ name: 'x', type: 'number', default: 0 }] },
    });
    const client = project.model.get().apps.find((app) => app.type === 'client')!;
    expect(catalog.forApp(client).some((item) => item.ref.startsWith('app:server#'))).toBe(false);

    const cache = join(
      workspace,
      'pong/.nanoforge/editor/cache/meta/modules/@nanoforge/motion.json',
    );
    expect(JSON.parse(readFileSync(cache, 'utf8'))).toMatchObject({
      metaVersion: 1,
      owners: { '@nanoforge/ecs': { version: '1.0.0', schema: 1 } },
    });
    expect(readFileSync(join(workspace, 'pong/.nanoforge/editor/.gitignore'), 'utf8')).toContain(
      'cache/',
    );
    catalog.dispose();
    code.dispose();
  });

  it('reuses a valid cache and extracts again when a source changes', async () => {
    const { code, catalog } = await setup();
    const extract = vi.spyOn(code, 'extractMeta');
    await catalog.refresh();
    expect(extract).not.toHaveBeenCalled();

    const path = 'apps/client/src/components/components.ts';
    const { text } = await project.fs.readText(path);
    await project.fs.write(
      path,
      `${text}\nexport class Health {\n  name = "Health";\n  constructor(public points = 3) {}\n}\n`,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    await catalog.whenIdle();
    expect(extract).toHaveBeenCalledTimes(1);
    expect(extract.mock.calls[0]![0].source).toMatchObject({ kind: 'app', name: 'client' });
    expect(catalog.get('app:client#Health')!.meta.params).toEqual([
      { name: 'points', type: 'number', default: 3, optional: true },
    ]);
    expect(existsSync(join(workspace, 'pong/.nanoforge/editor/cache/meta/apps/client.json'))).toBe(
      true,
    );
    catalog.dispose();
    code.dispose();
  });
});

describe('CatalogService (new files)', () => {
  it('lists an item of a file created after the first extraction', async () => {
    const { code, catalog } = await setup();
    await catalog.refresh();
    await project.fs.write(
      'apps/client/src/components/score.ts',
      '/** @component */\nexport class Score { name = "Score"; constructor(public value = 0) {} }\n',
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    await catalog.whenIdle();
    expect(catalog.get('app:client#Score')).toBeDefined();
    catalog.dispose();
    code.dispose();
  });
});
