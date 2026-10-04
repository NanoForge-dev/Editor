import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SyntaxKind } from 'ts-morph';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type CommandOrigin,
  HistoryService,
  type TextEdit,
  applyTextEdits,
} from '@nanoforge-dev/editor-history';
import { Emitter, ObservableValue } from '@nanoforge-dev/editor-kernel';
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
  CodeService,
  DiagnosticsService,
  type DocumentChange,
  DocumentService,
  type OpenDocument,
  type WorkerPluginModule,
  projectFsBackend,
} from '../../src';
import { serveEngine } from '../../src/worker-rpc/serve-engine';

const MAIN = 'apps/client/src/main.ts';

/** Worker plugin: renames the first `const` declared in a file. */
const renamePlugin: WorkerPluginModule = {
  activate: (sdk) => {
    sdk.registerTransformer('test.rename-first-const', ({ file, edit }, op) => {
      const declaration = file.getFirstDescendantByKindOrThrow(SyntaxKind.VariableDeclaration);
      edit.replace(declaration.getNameNode(), (op as { name: string }).name);
    });
  },
};

let workspace: string;
let editor: EditorServer;
let rpc: RpcClient;
let project: ClientProject;

const setup = () => {
  const documents = new DocumentService(projectFsBackend(project.fs));
  const diagnostics = new DiagnosticsService();
  const code = new CodeService({
    projectId: project.id,
    fs: project.fs,
    rpc,
    documents,
    diagnostics,
    diagnosticsDelayMs: 10,
    createWorker: () => {
      const channel = new MessageChannel();
      serveEngine(channel.port2 as never, { importModule: async () => renamePlugin });
      return channel.port1 as never;
    },
  });
  return { documents, diagnostics, code, history: new HistoryService() };
};

/** A Monaco-like open document. */
const fakeDocument = (uri: string, initial: string) => {
  let text = initial;
  const changes = new Emitter<DocumentChange>();
  const document: OpenDocument & { text(): string } = {
    uri,
    kind: 'text',
    onDidChange: changes.event,
    dirty: new ObservableValue(false),
    getText: () => text,
    text: () => text,
    applyEdits: (edits: readonly TextEdit[], origin: CommandOrigin | undefined) => {
      const result = applyTextEdits(text, edits);
      text = result.text;
      changes.fire({ uri, edits, origin });
      return result.inverse;
    },
    save: async () => undefined,
    revert: async () => undefined,
  };
  return document;
};

beforeAll(async () => {
  workspace = mkdtempSync(join(import.meta.dirname, '../../../server-core/test/.tmp-code-'));
  cpSync(
    join(import.meta.dirname, '../../../server-core/test/fixtures/pong-network'),
    join(workspace, 'pong'),
    { recursive: true },
  );
  const lib = join(workspace, 'pong/node_modules/@acme/speed');
  mkdirSync(lib, { recursive: true });
  writeFileSync(join(lib, 'package.json'), '{"name":"@acme/speed","types":"index.d.ts"}');
  writeFileSync(join(lib, 'index.d.ts'), 'export declare const maxSpeed: number;');
  mkdirSync(join(workspace, 'pong/checks'), { recursive: true });
  writeFileSync(join(workspace, 'pong/checks/broken.ts'), 'export const n: number =\n  "text";\n');
  mkdirSync(join(workspace, 'pong/nf_modules/@acme/pkg'), { recursive: true });
  writeFileSync(
    join(workspace, 'pong/nf_modules/@acme/pkg/bad.ts'),
    'export const n: number = "x";\n',
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
  }).open({
    path: 'pong',
  });
});

afterAll(() => {
  rpc.dispose();
  editor.dispose();
  rmSync(workspace, { recursive: true, force: true });
});

describe('CodeService', () => {
  it('sends edits to the open document instead of the file', async () => {
    const { documents, code, history } = setup();
    await code.loadWorkerPlugin('test/rename', 'memory://plugin');
    const onDisk = readFileSync(join(workspace, 'pong', MAIN), 'utf8');
    const document = fakeDocument(MAIN, onDisk);
    documents.register(document);
    const { stack } = history.registerContext({ id: 'file', label: MAIN });

    const command = await code.edit(
      MAIN,
      'test.rename-first-const',
      { name: 'renamed' },
      { label: 'Rename' },
    );
    await stack.push(command!);
    expect(document.text()).toMatch(/const renamed/);
    expect(readFileSync(join(workspace, 'pong', MAIN), 'utf8')).toBe(onDisk);
    await stack.undo();
    expect(document.text()).toBe(onDisk);
    code.dispose();
  });

  it('edits closed files on disk, undoes, and drops undo after an outside change', async () => {
    const { code, history } = setup();
    await code.loadWorkerPlugin('test/rename', 'memory://plugin');
    const { stack } = history.registerContext({ id: 'file', label: MAIN });
    const path = join(workspace, 'pong', MAIN);
    const original = readFileSync(path, 'utf8');

    await stack.push(
      (await code.edit(MAIN, 'test.rename-first-const', { name: 'app' }, { label: 'Rename' }))!,
    );
    expect(readFileSync(path, 'utf8')).toMatch(/const app\b/);
    await stack.undo();
    expect(readFileSync(path, 'utf8')).toBe(original);
    await stack.redo();

    writeFileSync(path, `${readFileSync(path, 'utf8')}\n// hand edit\n`);
    await new Promise((resolve) => setTimeout(resolve, 300)); // watcher → ProjectFs
    expect(await stack.undo()).toBe(false);
    expect(stack.state.canUndo).toBe(false);
    code.dispose();
  });

  it('publishes diagnostics of watched files with types from node_modules', async () => {
    const { code, documents, diagnostics } = setup();
    const uri = 'apps/client/src/speed.ts';
    documents.register(
      fakeDocument(
        uri,
        "import { maxSpeed } from '@acme/speed';\nexport const s: string = maxSpeed;\n",
      ),
    );
    await code.engine(); // mirror first, then the open document text is pushed on change
    await (await code.engine()).setFiles([{ path: uri, text: await documents.getText(uri) }]);
    const watch = code.watchDiagnostics(uri);
    const start = Date.now();
    while (!diagnostics.forUri(uri).length && Date.now() - start < 8000)
      await new Promise((r) => setTimeout(r, 25));
    expect(diagnostics.forUri(uri).map((d) => d.code)).toEqual([2322]);
    watch.dispose();
    expect(diagnostics.forUri(uri)).toEqual([]);
    code.dispose();
  });

  it('checks every file of the project while asked to, read-only packages aside', async () => {
    const { code, diagnostics } = setup();
    const uri = 'checks/broken.ts';
    const check = code.checkProject();
    const start = Date.now();
    while (!diagnostics.forUri(uri).length && Date.now() - start < 15_000)
      await new Promise((r) => setTimeout(r, 25));
    expect(diagnostics.forUri(uri)).toMatchObject([
      { code: 2322, source: 'typescript', line: 1, column: 14 },
    ]);
    expect(diagnostics.forUri('nf_modules/@acme/pkg/bad.ts')).toEqual([]);
    code.watchDiagnostics(uri).dispose();
    expect(diagnostics.forUri(uri)).toHaveLength(1);
    check.dispose();
    expect(diagnostics.forUri(uri)).toEqual([]);
    code.dispose();
  });
});
