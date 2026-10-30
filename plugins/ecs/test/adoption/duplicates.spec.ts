import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { CatalogState, ClientProject, PluginContext } from '@nanoforge-dev/editor-sdk';
import { CodeServiceToken, DocumentServiceToken } from '@nanoforge-dev/editor-sdk';

import { duplicateSuggestions } from '../../src/adoption/duplicate-checks';
import {
  IMPORTERS_ANALYZER,
  REDIRECTED_IMPORTS_ANALYZER,
  RELOCATED_TEXT_ANALYZER,
} from '../../src/model/ecs.const';
import {
  analyzeImporters,
  analyzeRedirectedImports,
  analyzeRelocatedText,
} from '../../src/worker/refactor';
import { FIXTURES, engineOf, expectTree, readTree } from '../fixtures/adoption/golden';

const app = (side: 'client' | 'server') => ({
  id: `apps/${side}`,
  name: `pong-${side}`,
  type: side,
  root: `apps/${side}`,
  language: 'ts',
  dirs: {
    assets: `apps/${side}/assets`,
    components: `apps/${side}/src/components`,
    systems: `apps/${side}/src/systems`,
    scenes: `apps/${side}/src/scenes`,
  },
  entryFile: `apps/${side}/src/main.ts`,
  engineLibs: {},
  libraries: [],
});
const position = (side: string) => ({
  ref: `app:${side}#Position`,
  source: { kind: 'app', name: `pong-${side}`, path: `apps/${side}` },
  meta: {
    export: 'Position',
    source: `apps/${side}/src/components/position.ts`,
    '@nanoforge/ecs': { type: 'component' },
  },
  readonly: false,
});

/** A plugin context and an open project over the fixture's files, the analyzers in a real engine. */
const setup = (files: Map<string, string>) => {
  const engine = engineOf(files);
  engine.registerAnalyzer(RELOCATED_TEXT_ANALYZER, analyzeRelocatedText);
  engine.registerAnalyzer(IMPORTERS_ANALYZER, analyzeImporters);
  engine.registerAnalyzer(REDIRECTED_IMPORTS_ANALYZER, analyzeRedirectedImports);
  const services = new Map<unknown, unknown>([
    [
      CodeServiceToken,
      {
        analyze: async (path: string, id: string, args?: unknown) => engine.analyze(path, id, args),
      },
    ],
    [DocumentServiceToken, { getText: async (path: string) => files.get(path)! }],
  ]);
  const context = {
    services: { tryGet: (token: unknown) => services.get(token) },
  } as unknown as PluginContext;
  const folders = new Set(
    [...files.keys()].flatMap((path) =>
      path
        .split('/')
        .slice(0, -1)
        .map((_, i, parts) => parts.slice(0, i + 1).join('/')),
    ),
  );
  const entries = [
    ...[...files.keys()].map((path) => ({ path, kind: 'file' })),
    ...[...folders].map((path) => ({ path, kind: 'folder' })),
  ];
  const model = {
    id: 'p',
    name: 'pong',
    location: '/pong',
    apps: [app('client'), app('server')],
    diagnostics: [],
  };
  const project = {
    model: { get: () => model },
    fs: {
      entries,
      entry: (path: string) => entries.find((entry) => entry.path === path),
      readText: async (path: string) => ({ text: files.get(path)! }),
    },
  } as unknown as ClientProject;
  return { context, project };
};

describe('client and server copies of a component', () => {
  it('moves identical copies to a new shared library both apps use', async () => {
    const files = readTree(join(FIXTURES, 'duplicates', 'input'));
    const { context, project } = setup(files);
    const state = {
      items: [position('client'), position('server')],
      diagnostics: [],
      loading: false,
    } as unknown as CatalogState;
    const [suggestion] = await duplicateSuggestions(context, project, state);
    expect(suggestion).toMatchObject({ id: 'ecs.duplicate:Position', title: 'Share Position' });
    const changeset = await suggestion!.fix!.changeset();
    for (const file of changeset.files) {
      if (file.after === undefined) files.delete(file.path);
      else files.set(file.path, file.after);
    }
    expectTree('duplicates', files);
  });

  it('says why when the copies differ', async () => {
    const files = readTree(join(FIXTURES, 'duplicates', 'input'));
    files.set(
      'apps/server/src/components/position.ts',
      'export class Position {\n  name = "Position";\n  z = 0;\n}\n',
    );
    const { context, project } = setup(files);
    const state = {
      items: [position('client'), position('server')],
      diagnostics: [],
      loading: false,
    } as unknown as CatalogState;
    const [suggestion] = await duplicateSuggestions(context, project, state);
    expect(suggestion?.fix).toBeUndefined();
    expect(suggestion?.detail).toContain('The copies differ');
  });
});
