/* eslint-disable no-restricted-imports -- tests run the worker code against the real code engine */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CODE_FILE, CodeEngine } from '@nanoforge-dev/editor-code/engine';
import { applyTextEdits } from '@nanoforge-dev/editor-history';

import type { EntryModel } from '../../src/model/ecs-model.type';
import { ECS_KEY } from '../../src/model/ecs.const';
import { analyzeEntry } from '../../src/worker/entry-file';
import { ecsOwner } from '../../src/worker/owner';
import { transformEntry } from '../../src/worker/transforms';

/** A copy of engine/e2e/game (the engine's end-to-end test game). */
const FIXTURE = join(import.meta.dirname, '../fixtures/e2e-game');
const MAIN = 'apps/client/src/main.ts';
const ROOTS = [{ path: 'apps/client', ref: 'app:client' }];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : CODE_FILE.test(name) ? [path] : [];
  });

const setup = () => {
  const engine = new CodeEngine();
  engine.setFiles(
    walk(FIXTURE).map((file) => ({
      path: relative(FIXTURE, file),
      text: readFileSync(file, 'utf8'),
    })),
  );
  engine.registerItemOwner(ecsOwner, '@nanoforge/ecs');
  engine.registerAnalyzer('entry', analyzeEntry);
  engine.registerTransformer('entry', transformEntry);
  return engine;
};

describe('engine e2e game', () => {
  it('reads its entity, component and system', () => {
    const model = setup().analyze(MAIN, 'entry', { roots: ROOTS }) as EntryModel;
    expect(model.entities).toMatchObject([
      {
        name: 'exampleEntity',
        components: [
          {
            className: 'ExampleComponent',
            item: 'app:client#ExampleComponent',
            args: [{ value: 'example' }, { value: 10 }],
          },
        ],
      },
    ]);
    expect(model.systems).toMatchObject([
      { name: 'exampleSystem', item: 'app:client#exampleSystem' },
    ]);
  });

  it('infers the component (name = this.constructor.name) and the system', async () => {
    const meta = await setup().extractMeta({
      source: { kind: 'app', name: 'client', path: 'apps/client' },
      files: [
        { path: 'apps/client/src/components/example.component.ts', folder: 'components' },
        { path: 'apps/client/src/systems/example.system.ts', folder: 'systems' },
      ],
      roots: ROOTS,
    });
    const byName = Object.fromEntries(meta.items.map((item) => [item.export, item]));
    expect(byName.ExampleComponent).toMatchObject({
      params: [
        { name: 'paramA', type: 'string' },
        { name: 'paramB', type: 'number' },
        { name: 'paramC', type: 'boolean', default: false, optional: true },
      ],
      [ECS_KEY]: { type: 'component', name: 'ExampleComponent' },
    });
    expect(byName.exampleSystem).toMatchObject({
      [ECS_KEY]: { type: 'system', query: [['app:client#ExampleComponent']], uses: ['app'] },
    });
  });

  it('round-trips an edit: only the argument changes', () => {
    const engine = setup();
    const before = engine.text(MAIN)!;
    const { text } = applyTextEdits(
      before,
      engine.transform(MAIN, 'entry', {
        kind: 'setArgs',
        entity: 'exampleEntity',
        index: 0,
        args: { 2: { value: true } },
        fill: [{ value: '' }, { value: 0 }, { value: false }],
      }),
    );
    expect(text).toBe(
      before.replace(
        'new ExampleComponent("example", 10)',
        'new ExampleComponent("example", 10, true)',
      ),
    );
  });
});
