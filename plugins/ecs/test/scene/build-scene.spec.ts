import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CODE_FILE, CodeEngine } from '@nanoforge-dev/editor-code/engine';

import type { EntryModel } from '../../src/model/ecs-model.type';
import { buildScene, withLivePositions } from '../../src/scene/build-scene';
import { analyzeEntry } from '../../src/worker/entry-file';
import { ecsOwner } from '../../src/worker/owner';

const FIXTURE = join(
  import.meta.dirname,
  '../../../../packages/server-core/test/fixtures/pong-network',
);
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules') return [];
    return statSync(path).isDirectory() ? walk(path) : CODE_FILE.test(name) ? [path] : [];
  });

describe('2D scene', () => {
  it('places an entity by its position, not by the first component with x and y', async () => {
    const root = join(import.meta.dirname, '../fixtures/pong-game');
    const engine = new CodeEngine();
    engine.setFiles(
      walk(root).map((file) => ({ path: relative(root, file), text: readFileSync(file, 'utf8') })),
    );
    engine.setTsconfig(readFileSync(join(root, 'tsconfig.json'), 'utf8'));
    engine.registerItemOwner(ecsOwner, '@nanoforge/ecs');
    engine.registerAnalyzer('entry', analyzeEntry);
    const roots = [
      { path: 'apps/client', ref: 'app:client' },
      { path: 'libs/shared', ref: '@pong-game/shared' },
    ];
    const model = engine.analyze('apps/client/src/main.ts', 'entry', { roots }) as EntryModel;
    const app = await engine.extractMeta({
      source: { kind: 'app', name: 'client', path: 'apps/client' },
      files: [{ path: 'apps/client/src/components/components.ts', folder: 'components' }],
      roots,
    });
    const library = await engine.extractMeta({
      source: { kind: 'lib', name: '@pong-game/shared', path: 'libs/shared' },
      files: ['position', 'velocity'].map((name) => ({
        path: `libs/shared/src/components/${name}.ts`,
        folder: 'components',
      })),
      roots,
    });
    const items = new Map(
      [
        ...app.items.map((item) => [`app:client#${item.export}`, item] as const),
        ...library.items.map((item) => [`@pong-game/shared#${item.export}`, item] as const),
      ].map(([ref, meta]) => [ref, { ref, meta }]),
    );
    const shapes = buildScene(
      model,
      (ref) => items.get(ref ?? '') as never,
      (_item, name) => name ?? '',
    );
    const ball = shapes.find((shape) => shape.entity === 'ball')!;
    expect([ball.x, ball.y]).toEqual([960, 540]);
    expect(ball.position).toMatchObject({ component: 1, componentName: 'Position' });
    expect(shapes.find((shape) => shape.entity === 'paddle2')).toMatchObject({ x: 1850, y: 390 });
  });

  it('draws pong from main.ts: rectangles and the ball at their positions', async () => {
    const engine = new CodeEngine();
    engine.setFiles(
      walk(FIXTURE).map((file) => ({
        path: relative(FIXTURE, file),
        text: readFileSync(file, 'utf8'),
      })),
    );
    engine.registerItemOwner(ecsOwner, '@nanoforge/ecs');
    engine.registerAnalyzer('entry', analyzeEntry);
    const roots = [{ path: 'apps/client', ref: 'app:client' }];
    const model = engine.analyze('apps/client/src/main.ts', 'entry', { roots }) as EntryModel;
    const meta = await engine.extractMeta({
      source: { kind: 'app', name: 'client', path: 'apps/client' },
      files: [{ path: 'apps/client/src/components/components.ts', folder: 'components' }],
      roots,
    });
    const items = new Map(
      meta.items.map((item) => [
        `app:client#${item.export}`,
        { ref: `app:client#${item.export}`, meta: item },
      ]),
    );
    const shapes = buildScene(
      model,
      (ref) => items.get(ref ?? '') as never,
      (_item, name) => name ?? '',
    );
    expect(
      shapes.map((shape) => [shape.entity, shape.kind, shape.x, shape.width, shape.fill]),
    ).toEqual([
      ['terrain', 'rect', 0, 1920, 'rgb(58,99,39)'],
      ['terrainLine', 'rect', 955, 10, 'rgb(148,204,117)'],
      ['ball', 'circle', 0, 50, 'red'],
      ['paddle1', 'rect', 0, 30, 'blue'],
      ['paddle2', 'rect', 0, 30, 'blue'],
    ]);
    expect(shapes[1]!.position).toEqual({
      component: 0,
      componentName: 'Position',
      xParam: 0,
      yParam: 1,
    });
    const live = withLivePositions(shapes, [
      {
        id: 1,
        code: 'terrainLine',
        runtime: false,
        components: [{ name: 'Position', value: { x: 900, y: 5 } }],
      },
    ]);
    expect([live[1]!.x, live[1]!.y]).toEqual([900, 5]);
  });

  it("draws components that take a shape's size as params (nf new's DrawableCircle2D)", () => {
    const arg = (value: unknown) => ({ code: JSON.stringify(value), start: 0, end: 0, value });
    const params = (...names: string[]) => ({
      meta: {
        params: names.map((name) => ({ name, type: name === 'fillColor' ? 'string' : 'number' })),
      },
    });
    const items: Record<string, unknown> = {
      position: params('x', 'y'),
      circle: params('radius', 'visible', 'fillColor'),
      box: params('width', 'height'),
    };
    const model = {
      entities: [
        {
          name: 'ball',
          components: [
            { item: 'position', className: 'Position2D', args: [arg(300), arg(200)] },
            {
              item: 'circle',
              className: 'DrawableCircle2D',
              args: [arg(40), arg(true), arg('orange')],
            },
          ],
        },
        {
          name: 'wall',
          components: [{ item: 'box', className: 'Box', args: [arg(10), arg(80)] }],
        },
      ],
    } as unknown as EntryModel;
    const shapes = buildScene(
      model,
      (ref) => items[ref ?? ''] as never,
      (_item, name) => name ?? '',
    );
    expect(shapes).toMatchObject([
      {
        entity: 'ball',
        kind: 'circle',
        x: 300,
        y: 200,
        radius: 40,
        fill: 'orange',
        position: { component: 0 },
      },
      { entity: 'wall', kind: 'rect', x: 0, y: 0, width: 10, height: 80 },
    ]);
  });
});
