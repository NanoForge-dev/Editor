import { ts } from 'ts-morph';

import type { AnalyzeContext } from '@nanoforge-dev/editor-sdk/worker';

export interface BundleSite {
  /** 1-based, as in stack traces. */
  readonly line: number;
  readonly column: number;
  /**
   * Count the spawns of the function the site is in (a scene's `setup`), not those of `main`.
   */
  readonly enclosing?: boolean;
}

export interface BundleSpawnsArgs {
  /** The built entry file (`main.js`). */
  readonly bundle: string;
  readonly sites: readonly BundleSite[];
}

const isSpawnCall = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  node.expression.name.text === 'spawnEntity';

/** The body of the bundle's `main` (a function, or a const holding one). */
const mainBody = (file: ts.SourceFile): ts.Node | undefined => {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'main') found = node.body;
    else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'main' &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    )
      found = node.initializer.body;
    else ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};

/** The body of the innermost function or method holding a position. */
const enclosingBody = (file: ts.SourceFile, offset: number): ts.Node | undefined => {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (offset < node.getStart(file) || offset > node.getEnd()) return;
    if (ts.isFunctionLike(node) && 'body' in node && node.body) found = node.body as ts.Node;
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};

/**
 * Which `spawnEntity()` of `main` each call site of a running game is: its index among the
 * spawn calls of `main` in the built bundle (the bundler keeps their order), or -1 when it
 * isn't in `main` (a system or a helper spawned it). No source maps needed.
 */
export const analyzeBundleSpawns = (_context: AnalyzeContext, rawArgs: unknown): number[] => {
  const { bundle, sites } = rawArgs as BundleSpawnsArgs;
  const file = ts.createSourceFile(
    'main.js',
    bundle,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const spawnsIn = (body: ts.Node): ts.CallExpression[] => {
    const calls: ts.CallExpression[] = [];
    const collect = (node: ts.Node) => {
      if (isSpawnCall(node)) calls.push(node);
      ts.forEachChild(node, collect);
    };
    collect(body);
    return calls;
  };
  const main = mainBody(file);
  const mainCalls = main ? spawnsIn(main) : [];
  const lineStarts = file.getLineStarts();
  return sites.map((site) => {
    const lineStart = lineStarts[site.line - 1];
    if (lineStart === undefined) return -1;
    const offset = lineStart + site.column - 1;
    const body = site.enclosing ? enclosingBody(file, offset) : main;
    if (!body) return -1;
    const calls = site.enclosing ? spawnsIn(body) : mainCalls;
    const inside = calls.findIndex(
      (call) => call.getStart(file) <= offset && offset <= call.getEnd(),
    );
    if (inside >= 0) return inside;
    return calls.findIndex(
      (call) => file.getLineAndCharacterOfPosition(call.getStart(file)).line === site.line - 1,
    );
  });
};
