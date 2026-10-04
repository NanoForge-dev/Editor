import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Node, SyntaxKind } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { applyTextEdits } from '@nanoforge-dev/editor-history';

import {
  CODE_FILE,
  CodeEngine,
  CodeError,
  type TransformContext,
  literalToValue,
  valueToLiteral,
} from '../../src/engine';

const FIXTURE = join(import.meta.dirname, '../../../server-core/test/fixtures/pong-network');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : CODE_FILE.test(name) ? [path] : [];
  });

const pong = () =>
  walk(FIXTURE).map((file) => ({
    path: relative(FIXTURE, file).split('\\').join('/'),
    text: readFileSync(file, 'utf8'),
  }));

/** Toy transformer: renames a top level const and all its references in the file. */
const renameConst = ({ file, edit }: TransformContext, op: unknown) => {
  const { from, to } = op as { from: string; to: string };
  const declaration = file.getVariableDeclarationOrThrow(from);
  const name = declaration.getNameNode();
  edit.replace(name, to);
  for (const identifier of file.getDescendantsOfKind(SyntaxKind.Identifier)) {
    if (
      identifier !== name &&
      identifier.getText() === from &&
      identifier.getSymbol() === name.getSymbol()
    ) {
      edit.replace(identifier, to);
    }
  }
};

describe('CodeEngine', () => {
  it('keeps every pong-network file byte-identical and a no-op transform yields no edit', () => {
    const engine = new CodeEngine();
    const files = pong();
    expect(files.length).toBeGreaterThan(6);
    engine.setFiles(files);
    engine.registerTransformer('noop', () => undefined);
    for (const { path, text } of files) {
      expect(engine.text(path)).toBe(text);
      expect(engine.transform(path, 'noop', null)).toEqual([]);
    }
  });

  it('renames a const with edits limited to identifiers', () => {
    const engine = new CodeEngine();
    const text = [
      '// keep this comment',
      'const speed   =  2; // odd spacing is kept',
      '',
      'export function move(x: number) {',
      '  return x * speed + other.speed;',
      '}',
      'const other = { speed: 1 };',
      '',
    ].join('\n');
    engine.setFiles([{ path: 'src/a.ts', text }]);
    engine.registerTransformer('rename', renameConst);
    const edits = engine.transform('src/a.ts', 'rename', { from: 'speed', to: 'velocity' });
    expect(edits.every((edit) => text.slice(edit.start, edit.end) === 'speed')).toBe(true);
    expect(edits).toHaveLength(2);
    expect(applyTextEdits(text, edits).text).toBe(
      text.replace('const speed ', 'const velocity ').replace('x * speed', 'x * velocity'),
    );
  });

  it('lists the symbols of a file with their kind, container and position', () => {
    const engine = new CodeEngine();
    engine.setFiles([
      {
        path: 'src/shapes.ts',
        text: [
          'export class Position {',
          '  x = 0;',
          '  move(dx: number) {',
          '    this.x += dx;',
          '  }',
          '}',
          '',
          'export const SPEED = 2;',
          'export function update() {}',
          'interface Shape {',
          '  size: number;',
          '}',
          '',
        ].join('\n'),
      },
    ]);
    expect(
      engine
        .symbols('src/shapes.ts')
        .map((symbol) => [symbol.name, symbol.kind, symbol.container, symbol.line, symbol.column]),
    ).toEqual([
      ['Position', 'class', undefined, 1, 14],
      ['x', 'property', 'Position', 2, 3],
      ['move', 'method', 'Position', 3, 3],
      ['SPEED', 'const', undefined, 8, 14],
      ['update', 'function', undefined, 9, 17],
      ['Shape', 'interface', undefined, 10, 11],
      ['size', 'property', 'Shape', 11, 3],
    ]);
    expect(engine.symbols('src/missing.ts')).toEqual([]);
  });

  it('runs analyzers returning references that resolve back to nodes', () => {
    const engine = new CodeEngine();
    engine.setFiles(pong());
    engine.registerAnalyzer('spawns', ({ file, ref }) =>
      file
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter((call) => call.getExpression().getText().endsWith('spawnEntity'))
        .map((call) => ref(call)),
    );
    const refs = engine.analyze('apps/client/src/main.ts', 'spawns') as {
      id: string;
      start: number;
      kind: string;
    }[];
    expect(refs.length).toBeGreaterThan(0);
    engine.registerAnalyzer('resolve', ({ resolve }, target) =>
      resolve(target as never)?.getText(),
    );
    expect(engine.analyze('apps/client/src/main.ts', 'resolve', refs[0])).toMatch(
      /spawnEntity\(\)/,
    );
  });

  it('reports syntax and type errors', async () => {
    const engine = new CodeEngine();
    engine.setFiles([{ path: 'src/bad.ts', text: 'const a: number = "x";\nconst b = ;\n' }]);
    const diagnostics = await engine.diagnostics(['src/bad.ts']);
    expect(diagnostics.map((d) => [d.severity, d.code])).toEqual(
      expect.arrayContaining([
        ['error', 2322],
        ['error', 1109],
      ]),
    );
  });

  it('loads type declarations of bare imports on demand', async () => {
    const requested: string[] = [];
    const engine = new CodeEngine({
      resolveTypes: async (module) => {
        requested.push(module);
        return [
          {
            path: 'node_modules/@acme/lib/package.json',
            text: '{"name":"@acme/lib","types":"index.d.ts"}',
          },
          {
            path: 'node_modules/@acme/lib/index.d.ts',
            text: 'export declare const answer: number;',
          },
        ];
      },
    });
    engine.setFiles([
      {
        path: 'src/a.ts',
        text: "import { answer } from '@acme/lib';\nconst s: string = answer;\n",
      },
    ]);
    const diagnostics = await engine.diagnostics(['src/a.ts']);
    expect(requested).toEqual(['@acme/lib']);
    expect(diagnostics.map((d) => d.code)).toContain(2322);
  });

  it('loads the declarations of a package for each app that has its own node_modules', async () => {
    const requested: string[] = [];
    const engine = new CodeEngine({
      resolveTypes: async (module, from) => {
        requested.push(`${module} from ${from}`);
        const app = /^apps\/[^/]+/.exec(from)?.[0];
        if (!app) return [];
        return [
          {
            path: `${app}/node_modules/@acme/lib/package.json`,
            text: '{"name":"@acme/lib","types":"index.d.ts"}',
          },
          {
            path: `${app}/node_modules/@acme/lib/index.d.ts`,
            text: 'export declare const answer: number;',
          },
        ];
      },
    });
    const text = "import { answer } from '@acme/lib';\nexport const value: number = answer;\n";
    engine.setFiles([
      { path: 'apps/client/src/main.ts', text },
      { path: 'apps/client/src/systems/move.ts', text },
      { path: 'apps/server/src/main.ts', text },
      { path: 'test/game.spec.ts', text },
    ]);
    const paths = [
      'apps/client/src/main.ts',
      'apps/client/src/systems/move.ts',
      'apps/server/src/main.ts',
      'test/game.spec.ts',
    ];
    const diagnostics = await engine.diagnostics(paths);
    expect(requested).toEqual([
      '@acme/lib from apps/client/src/main.ts',
      '@acme/lib from apps/server/src/main.ts',
      '@acme/lib from test/game.spec.ts',
    ]);
    expect(diagnostics.filter((d) => d.code === 2307).map((d) => d.path)).toEqual([
      'test/game.spec.ts',
    ]);
    await engine.diagnostics(paths);
    expect(requested).toHaveLength(3);
  });

  it('checks each app in a program of its own: type augmentations do not leak', async () => {
    const engine = new CodeEngine({
      resolveTypes: async (_module, from) => {
        const app = /^apps\/([^/]+)/.exec(from);
        if (!app) return [];
        return [
          {
            path: `${app[0]}/node_modules/@acme/net/package.json`,
            text: '{"name":"@acme/net","types":"index.d.ts"}',
          },
          {
            path: `${app[0]}/node_modules/@acme/net/index.d.ts`,
            text: `export declare const side: '${app[1]}';\ndeclare global { interface Ctx { net: '${app[1]}' } }\n`,
          },
        ];
      },
    });
    const main = (side: string) =>
      `import { side } from '@acme/net';\nimport { shared } from '../../../libs/shared/src/index';\ndeclare const ctx: Ctx;\nexport const net: '${side}' = ctx.net;\nexport const all = [side, shared];\n`;
    engine.setFiles([
      { path: 'apps/client/src/main.ts', text: main('client') },
      { path: 'apps/server/src/main.ts', text: main('server') },
      { path: 'libs/shared/src/index.ts', text: 'export const shared: number = 1;\n' },
    ]);
    const paths = [
      'apps/client/src/main.ts',
      'apps/server/src/main.ts',
      'libs/shared/src/index.ts',
    ];
    expect(await engine.diagnostics(paths)).toEqual([]);

    engine.setFiles([
      { path: 'apps/server/src/main.ts', text: main('client') },
      { path: 'libs/shared/src/index.ts', text: "export const shared: number = 'one';\n" },
    ]);
    const after = await engine.diagnostics(paths);
    expect(after.map((d) => [d.path, d.code])).toEqual([
      ['apps/server/src/main.ts', 2322],
      ['libs/shared/src/index.ts', 2322],
    ]);
    engine.deleteFiles(['libs/shared/src/index.ts']);
    expect((await engine.diagnostics(['apps/client/src/main.ts'])).map((d) => d.code)).toEqual([
      2307,
    ]);
  });

  it('refuses overlapping edits', () => {
    const engine = new CodeEngine();
    engine.setFiles([{ path: 'a.ts', text: 'const a = 1;' }]);
    engine.registerTransformer('overlap', ({ edit }) =>
      edit.replace({ start: 0, end: 5 }, 'x').replace({ start: 3, end: 8 }, 'y'),
    );
    expect(() => engine.transform('a.ts', 'overlap', null)).toThrow(CodeError);
  });
});

describe('organizeImports', () => {
  it('sorts imports and drops unused ones', async () => {
    const engine = new CodeEngine();
    const text = "import { b } from './b';\nimport { z, a } from './a';\n\nconsole.log(a, b);\n";
    engine.setFiles([
      { path: 'src/main.ts', text },
      { path: 'src/a.ts', text: 'export const a = 1;\nexport const z = 2;\n' },
      { path: 'src/b.ts', text: 'export const b = 1;\n' },
    ]);
    const edits = await engine.organizeImports('src/main.ts');
    expect(applyTextEdits(text, edits).text).toBe(
      "import { a } from './a';\nimport { b } from './b';\n\nconsole.log(a, b);\n",
    );
  });
});

describe('literals', () => {
  const engine = new CodeEngine();
  const valueOf = (source: string) => {
    engine.setFiles([{ path: 'l.ts', text: `export const X = ${source};` }]);
    const file = engine.project.getSourceFileOrThrow('/project/l.ts');
    return literalToValue(file.getVariableDeclarationOrThrow('X').getInitializerOrThrow());
  };

  it('reads literals', () => {
    expect(
      valueOf(
        `{ name: "Ball", params: [{ type: 'number', default: -2.5, optional: true }], "x-y": null } as const`,
      ),
    ).toEqual({
      name: 'Ball',
      params: [{ type: 'number', default: -2.5, optional: true }],
      'x-y': null,
    });
  });

  it('rejects computed values with their position', () => {
    try {
      valueOf('{ a: Math.PI }');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CodeError);
      expect((error as CodeError).message).toContain('Math.PI');
      expect((error as CodeError).start).toBe(22);
    }
  });

  it('prints values that read back identically', () => {
    const value = {
      name: "Bob's ball",
      size: [1, -2],
      nested: { a: true, 'b-c': null },
      long: 'x'.repeat(70),
    };
    const printed = valueToLiteral(value, { quote: "'", indent: '  ' });
    expect(printed).toContain("'Bob\\'s ball'");
    expect(printed).toContain("'b-c': null");
    expect(valueOf(printed)).toEqual(value);
    expect(valueToLiteral({ x: 1, y: 2 })).toBe('{ x: 1, y: 2 }');
  });

  it('ignores Node import (type-only check)', () => {
    expect(typeof Node.isIdentifier).toBe('function');
  });
});
