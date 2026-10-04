/* eslint-disable no-restricted-imports -- tests run the worker code against the real code engine */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CODE_FILE, CodeEngine } from '@nanoforge-dev/editor-code/engine';
import { applyTextEdits } from '@nanoforge-dev/editor-history';

import type { EntryModel, EntryOp } from '../../src/model/ecs-model.type';
import { ECS_KEY } from '../../src/model/ecs.const';
import { analyzeEntry } from '../../src/worker/entry-file';
import { ecsOwner } from '../../src/worker/owner';
import { transformEntry } from '../../src/worker/transforms';

const FIXTURE = join(
  import.meta.dirname,
  '../../../../packages/server-core/test/fixtures/pong-network',
);
const MAIN = 'apps/client/src/main.ts';
const ROOTS = [
  { path: 'apps/client', ref: 'app:client' },
  { path: 'apps/server', ref: 'app:server' },
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules') return [];
    return statSync(path).isDirectory() ? walk(path) : CODE_FILE.test(name) ? [path] : [];
  });

const setup = () => {
  const engine = new CodeEngine();
  engine.setFiles(
    walk(FIXTURE).map((file) => ({
      path: relative(FIXTURE, file).split('\\').join('/'),
      text: readFileSync(file, 'utf8'),
    })),
  );
  engine.registerItemOwner(ecsOwner, '@nanoforge/ecs');
  engine.registerAnalyzer('ecs.entry-file', analyzeEntry);
  engine.registerTransformer('ecs.entry-file', transformEntry);
  return engine;
};

const analyze = (engine: CodeEngine, path = MAIN) =>
  engine.analyze(path, 'ecs.entry-file', { roots: ROOTS }) as EntryModel;

/** Applies an op and returns the new text (and puts it in the engine). */
const apply = (engine: CodeEngine, op: EntryOp, path = MAIN) => {
  const before = engine.text(path)!;
  const { text } = applyTextEdits(before, engine.transform(path, 'ecs.entry-file', op));
  engine.setFiles([{ path, text }]);
  return { before, text };
};

/** Lines added and removed by a change (a readable golden diff). */
const diff = (before: string, after: string) => {
  const a = before.split('\n');
  const b = after.split('\n');
  return {
    removed: a.filter((line) => !b.includes(line)),
    added: b.filter((line) => !a.includes(line)),
  };
};

describe('entry file analyzer (pong-network client)', () => {
  it('reads entities, components, systems', () => {
    const model = analyze(setup());
    expect(model.found).toBe(true);
    expect(model.registry).toBe('registry');
    expect(model.codeOnly).toEqual([]);
    expect(
      model.entities.map((entity) => ({
        name: entity.name,
        components: entity.components.map((component) => ({
          class: component.className,
          item: component.item,
          args: component.args.map((arg) => arg.value ?? arg.code),
        })),
      })),
    ).toMatchSnapshot();
    expect(model.systems.map((system) => [system.name, system.item])).toEqual([
      ['packetHandler', 'app:client#packetHandler'],
      ['move', 'app:client#move'],
      ['controlPlayer', 'app:client#controlPlayer'],
      ['draw', 'app:client#draw'],
    ]);
  });

  it('marks spawns it cannot model as code-only', () => {
    const engine = setup();
    engine.setFiles([
      {
        path: 'apps/client/src/extra.ts',
        text: [
          'declare const registry: { spawnEntity(): unknown; addComponent(e: unknown, c: unknown): void };',
          'export const main = () => {',
          '  const hero = registry.spawnEntity();',
          '  for (let i = 0; i < 3; i++) registry.spawnEntity();',
          '};',
        ].join('\n'),
      },
    ]);
    const model = analyze(engine, 'apps/client/src/extra.ts');
    expect(model.entities.map((entity) => entity.name)).toEqual(['hero']);
    expect(model.codeOnly).toMatchObject([
      { line: 4, code: 'for (let i = 0; i < 3; i++) registry.spawnEntity();' },
    ]);
  });
});

describe('ecs item owner', () => {
  it('infers pong components and systems, with queries and ctx uses', async () => {
    const engine = setup();
    const result = await engine.extractMeta({
      source: { kind: 'app', name: 'client', path: 'apps/client' },
      files: [
        { path: 'apps/client/src/components/components.ts', folder: 'components' },
        { path: 'apps/client/src/systems/systems.ts', folder: 'systems' },
      ],
      roots: ROOTS,
    });
    const byName = Object.fromEntries(result.items.map((item) => [item.export, item]));
    expect(byName.Position).toMatchObject({
      params: [
        { name: 'x', type: 'number' },
        { name: 'y', type: 'number' },
      ],
      fields: [],
      [ECS_KEY]: { type: 'component', name: 'Position', inferred: true },
    });
    expect(byName.move).toMatchObject({
      params: [],
      [ECS_KEY]: {
        type: 'system',
        query: [['app:client#Position', 'app:client#Velocity']],
        uses: ['app'],
        inferred: true,
      },
    });
  });
});

describe('entry file transformer', () => {
  it('adds, renames, duplicates and removes an entity', () => {
    const engine = setup();
    let step = apply(engine, { kind: 'addEntity', name: 'score' });
    expect(diff(step.before, step.text)).toEqual({
      removed: [],
      added: ['  const score = registry.spawnEntity();'],
    });
    expect(step.text.indexOf('const score')).toBeGreaterThan(step.text.indexOf('paddle2,\n'));

    step = apply(engine, { kind: 'renameEntity', entity: 'me', name: 'player' });
    expect(step.text).toContain('const player = registry.spawnEntity();');
    expect(step.text).toContain('registry.addComponent(player, new Controller(');

    step = apply(engine, { kind: 'duplicateEntity', entity: 'player' });
    expect(diff(step.before, step.text).added).toEqual([
      '  const playerCopy = registry.spawnEntity();',
      '  registry.addComponent(playerCopy, new Controller(InputEnum.ArrowUp, InputEnum.ArrowDown));',
    ]);

    step = apply(engine, { kind: 'removeEntity', entity: 'playerCopy' });
    expect(diff(step.before, step.text)).toEqual({
      removed: [
        '  const playerCopy = registry.spawnEntity();',
        '  registry.addComponent(playerCopy, new Controller(InputEnum.ArrowUp, InputEnum.ArrowDown));',
      ],
      added: [],
    });
  });

  it('adds a component with its import, edits and removes it', () => {
    const engine = setup();
    let step = apply(engine, {
      kind: 'addComponent',
      entity: 'ball',
      className: 'Player',
      args: [{ value: 'one' }, { value: 3 }],
      imports: [{ name: 'Player', from: 'libs/shared/src/components/player.ts' }],
    });
    expect(diff(step.before, step.text).added).toEqual([
      'import { Player } from "../../../libs/shared/src/components/player";',
      '  registry.addComponent(ball, new Player("one", 3));',
    ]);

    const model = analyze(engine);
    const ball = model.entities.find((entity) => entity.name === 'ball')!;
    const index = ball.components.findIndex((component) => component.className === 'Player');
    step = apply(engine, { kind: 'setArgs', entity: 'ball', index, args: { 1: { value: 5 } } });
    expect(diff(step.before, step.text)).toEqual({
      removed: ['  registry.addComponent(ball, new Player("one", 3));'],
      added: ['  registry.addComponent(ball, new Player("one", 5));'],
    });
    step = apply(engine, {
      kind: 'setArgs',
      entity: 'ball',
      index,
      args: { 3: { code: 'InputEnum.ArrowUp' } },
      fill: [{ value: '' }, { value: 0 }, { value: false }],
    });
    expect(step.text).toContain('new Player("one", 5, false, InputEnum.ArrowUp)');

    step = apply(engine, { kind: 'removeComponent', entity: 'ball', index });
    expect(diff(step.before, step.text).removed).toEqual([
      '  registry.addComponent(ball, new Player("one", 5, false, InputEnum.ArrowUp));',
    ]);
  });

  it('merges an import into an existing one and keeps the rest byte-identical', () => {
    const engine = setup();
    const { before, text } = apply(engine, {
      kind: 'addComponent',
      entity: 'terrain',
      className: 'NetworkId',
      args: [{ value: 1 }],
      imports: [{ name: 'NetworkId', from: 'apps/client/src/components/components.ts' }],
    });
    expect(text).toContain('  Velocity, NetworkId,\n} from "./components/components";');
    const untouched = before.slice(
      before.indexOf('export const layer'),
      before.indexOf('  const terrainLine'),
    );
    expect(text).toContain(
      untouched.replace('new Position(0, 0));\n', 'new Position(0, 0));\n').slice(0, 200),
    );
    expect(text.slice(text.indexOf('  const terrainLine'))).toBe(
      before.slice(before.indexOf('  const terrainLine')),
    );
  });

  it('reorders entities, components and systems', () => {
    const engine = setup();
    let step = apply(engine, { kind: 'moveEntity', entity: 'me', before: 'ball' });
    let model = analyze(engine);
    expect(model.entities.map((entity) => entity.name)).toEqual([
      'terrain',
      'terrainLine',
      'me',
      'ball',
      'paddle1',
      'paddle2',
    ]);
    expect(step.text.length).toBe(step.before.length);

    step = apply(engine, { kind: 'moveComponent', entity: 'ball', from: 0, to: 1 });
    model = analyze(engine);
    expect(
      model.entities.find((entity) => entity.name === 'ball')!.components.map((c) => c.className),
    ).toEqual(['Position', 'Velocity', 'CircleComponent']);

    apply(engine, { kind: 'moveSystem', from: 3, to: 0 });
    apply(engine, { kind: 'removeSystem', index: 1 });
    apply(engine, {
      kind: 'addSystem',
      name: 'score',
      imports: [{ name: 'score', from: 'apps/client/src/systems/score.ts' }],
    });
    model = analyze(engine);
    expect(model.systems.map((system) => system.name)).toEqual([
      'draw',
      'move',
      'controlPlayer',
      'score',
    ]);
    expect(engine.text(MAIN)).toContain('import { score } from "./systems/score";');
  });

  it('refuses to remove an entity used elsewhere', () => {
    const engine = setup();
    engine.setFiles([
      {
        path: MAIN,
        text: engine
          .text(MAIN)!
          .replace('await app.run();', 'console.log(ball);\n  await app.run();'),
      },
    ]);
    expect(() =>
      engine.transform(MAIN, 'ecs.entry-file', { kind: 'removeEntity', entity: 'ball' }),
    ).toThrow(/used elsewhere/);
  });
});

describe('entry file on a scene setup', () => {
  const SCENE = 'apps/client/src/scenes/level.ts';
  const SCOPE = { kind: 'method', class: 'Level', method: 'setup' } as const;
  const sceneEngine = (setupBody: string) => {
    const engine = setup();
    engine.setFiles([
      {
        path: SCENE,
        text: [
          "import type { Context } from '@nanoforge-dev/common';",
          "import type { Registry } from '@nanoforge-dev/ecs/client';",
          "import { EcsScene } from '@nanoforge-dev/ecs/scene';",
          '',
          "import { Position } from '../components/components';",
          '',
          'export class Level extends EcsScene {',
          `  override setup(registry: Registry, ctx: Context) {${setupBody}}`,
          '}',
          '',
        ].join('\n'),
      },
    ]);
    return engine;
  };

  it('reads the spawns and systems of the method', () => {
    const engine = sceneEngine(
      '\n    const wall = registry.spawnEntity();\n    registry.addComponent(wall, new Position(1, 2));\n    registry.addSystem(move);\n  ',
    );
    const model = engine.analyze(SCENE, 'ecs.entry-file', {
      roots: ROOTS,
      scope: SCOPE,
    }) as EntryModel;
    expect(model.found).toBe(true);
    expect(model.registry).toBe('registry');
    expect(model.entities.map((entity) => entity.name)).toEqual(['wall']);
    expect(model.entities[0]!.components[0]!.className).toBe('Position');
    expect(model.systems.map((system) => system.code)).toEqual(['move']);
  });

  it('says so when the class has no such method', () => {
    const model = sceneEngine('').analyze(SCENE, 'ecs.entry-file', {
      roots: ROOTS,
      scope: { kind: 'method', class: 'Level', method: 'teardown' },
    }) as EntryModel;
    expect(model.found).toBe(false);
    expect(model.problems).toEqual(['No `Level.teardown` method in this file.']);
  });

  it('writes into an empty setup, the registry being its first parameter', () => {
    const engine = sceneEngine('');
    expect(
      (engine.analyze(SCENE, 'ecs.entry-file', { roots: ROOTS, scope: SCOPE }) as EntryModel)
        .registry,
    ).toBe('registry');
    const added = apply(
      engine,
      { kind: 'addEntity', name: 'wall', scope: SCOPE } as EntryOp,
      SCENE,
    );
    expect(diff(added.before, added.text)).toEqual({
      removed: ['  override setup(registry: Registry, ctx: Context) {}'],
      added: [
        '  override setup(registry: Registry, ctx: Context) {',
        '    const wall = registry.spawnEntity();',
        '  }',
      ],
    });
    const system = apply(
      engine,
      {
        kind: 'addSystem',
        name: 'move',
        imports: [{ name: 'move', from: 'apps/client/src/systems/systems.ts' }],
        scope: SCOPE,
      } as EntryOp,
      SCENE,
    );
    expect(diff(system.before, system.text).added).toEqual([
      "import { move } from '../systems/systems';",
      '    registry.addSystem(move);',
    ]);
  });
});
