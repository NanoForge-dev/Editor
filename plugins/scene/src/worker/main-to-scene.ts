import { Node, type Statement, SyntaxKind } from 'ts-morph';

import { type AnalyzeContext, CodeError } from '@nanoforge-dev/editor-sdk/worker';

import { type Binding, bindingsOf, importLine } from './import-line';
import { projectPath } from './scenes';
import { applyEdits, dedent, ownStart, removalStart, trailingEnd } from './source-edits';

/** Where the scene goes, and its class. */
interface MainToSceneArgs {
  readonly scenePath: string;
  readonly className: string;
  readonly side: 'client' | 'server';
}

export interface MainToSceneResult {
  readonly scene: string;
  readonly main: string;
  /** The entities and systems moved (their variables, the systems' names). */
  readonly entities: readonly string[];
  readonly systems: readonly string[];
}

const REGISTRY_CALLS = new Set(['spawnEntity', 'addComponent', 'addSystem']);

/** The registry call a statement makes (`registry.addSystem(…)`), with the registry's text. */
const registryCall = (statement: Statement) => {
  let call: Node | undefined;
  if (Node.isExpressionStatement(statement)) call = statement.getExpression();
  else if (Node.isVariableStatement(statement)) {
    const declarations = statement.getDeclarations();
    if (declarations.length === 1) call = declarations[0]!.getInitializer();
  }
  if (!call || !Node.isCallExpression(call)) return undefined;
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || !REGISTRY_CALLS.has(callee.getName()))
    return undefined;
  if (Node.isVariableStatement(statement) && callee.getName() !== 'spawnEntity') return undefined;
  return { method: callee.getName(), registry: callee.getExpression(), call };
};

/**
 * Moves what `main` makes with the registry (`spawnEntity`, `addComponent`, `addSystem`) into the
 * `setup` of a new scene class, and registers `SceneLibrary` with it as the initial scene.
 * Read-only: returns the scene's text and main's. Refused when those statements use variables of
 * main itself (other than the registry).
 */
export const analyzeMainToScene = (context: AnalyzeContext, args: unknown): MainToSceneResult => {
  const { scenePath, className, side } = args as MainToSceneArgs;
  const file = context.file;
  const main =
    file.getFunction('main') ??
    file.getVariableDeclaration('main')?.getInitializerIfKind(SyntaxKind.ArrowFunction) ??
    file.getVariableDeclaration('main')?.getInitializerIfKind(SyntaxKind.FunctionExpression);
  const body = main?.getBody();
  if (!main || !body || !Node.isBlock(body))
    throw new CodeError(`${context.path} has no main function.`);
  const statements = body.getStatements();
  const moved = statements.filter((statement) => registryCall(statement));
  if (!moved.length) throw new CodeError('main makes no entity nor system.');
  const registries = new Set(moved.map((statement) => registryCall(statement)!.registry.getText()));
  if (registries.size > 1)
    throw new CodeError(`main uses several registries (${[...registries].join(', ')}).`);
  const registryText = [...registries][0]!;
  const registryNode = registryCall(moved[0]!)!.registry;
  const registryDeclaration = Node.isIdentifier(registryNode)
    ? registryNode.getSymbol()?.getDeclarations()[0]
    : undefined;
  /**
   * A registry named by a variable becomes setup's parameter, under the same name: the moved
   * code is kept as it is. Another expression (`ecs.registry`) is replaced where it occurs.
   */
  const registryParam = Node.isIdentifier(registryNode) ? registryText : 'registry';
  const occurrences = Node.isIdentifier(registryNode)
    ? []
    : moved.flatMap((statement) =>
        statement
          .getDescendants()
          .filter(
            (node) =>
              node.getKind() === registryNode.getKind() &&
              node.getText() === registryText &&
              node.getSymbol() === registryNode.getSymbol(),
          ),
      );
  const inRegistry = (node: Node) =>
    occurrences.some((occurrence) => occurrence.containsRange(node.getPos(), node.getEnd()));

  const quote = file.getImportDeclarations()[0]?.getModuleSpecifier().getText()[0] ?? '"';
  const needs = new Map<string, Binding[]>();
  const need = (module: string, binding: Binding) =>
    needs.set(module, [...(needs.get(module) ?? []), binding]);
  const locals = new Set<string>();
  const insideMoved = (node: Node) =>
    moved.some((statement) => statement.containsRange(node.getPos(), node.getEnd()));
  const fromMain = new Set<string>();
  for (const statement of moved)
    for (const identifier of statement.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if (inRegistry(identifier)) continue;
      const declaration = identifier.getSymbol()?.getDeclarations()[0];
      if (!declaration || declaration.getSourceFile() !== file) continue;
      if (declaration === registryDeclaration) continue;
      if (insideMoved(declaration)) continue;
      const importDeclaration = declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
      if (importDeclaration) {
        const binding = bindingsOf(importDeclaration).find(
          (candidate) => candidate.local === identifier.getText(),
        );
        if (!binding) continue;
        const target = importDeclaration.getModuleSpecifierSourceFile();
        const value = importDeclaration.getModuleSpecifierValue();
        need(
          value.startsWith('.') && target
            ? context.moduleSpecifier(projectPath(target), scenePath)
            : value,
          binding,
        );
        continue;
      }
      if (main.containsRange(declaration.getPos(), declaration.getEnd())) {
        locals.add(identifier.getText());
        continue;
      }
      const top = declaration.getFirstAncestor((node) => Node.isSourceFile(node.getParent()));
      if (top && Node.isExportable(top) && top.isExported()) fromMain.add(identifier.getText());
      else locals.add(identifier.getText());
    }
  locals.delete(registryText);
  /** What stays in main must not use what moves (an entity's variable). */
  const stillUsed = new Set<string>();
  for (const statement of statements.filter((candidate) => !moved.includes(candidate)))
    for (const identifier of statement.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const declaration = identifier.getSymbol()?.getDeclarations()[0];
      if (declaration && insideMoved(declaration)) stillUsed.add(identifier.getText());
    }
  if (stillUsed.size)
    throw new CodeError(
      `main still uses ${[...stillUsed].join(', ')} after making ${stillUsed.size === 1 ? 'it' : 'them'}: move that code into the scene by hand, or keep these entities in main.`,
    );
  if (fromMain.size)
    throw new CodeError(
      `main's entities use ${[...fromMain].sort().join(', ')} of ${context.path}, which imports the scene: move ${fromMain.size === 1 ? 'it' : 'them'} to a module of ${fromMain.size === 1 ? 'its' : 'their'} own first.`,
    );
  if (locals.size)
    throw new CodeError(
      `main's entities use ${[...locals].join(', ')}, made in main itself: move ${locals.size === 1 ? 'it' : 'them'} out of main (or into the scene by hand) first.`,
    );

  const lines = [...needs].map(([module, bindings]) => importLine(module, bindings, quote));
  const packages = lines.filter((line) => !/ from ["']\./.test(line));
  const relative = lines.filter((line) => / from ["']\./.test(line));
  const setup = moved
    .map((statement) => {
      const start = ownStart(statements, statement);
      const raw = applyEdits(
        context.text.slice(start, trailingEnd(statement)),
        occurrences
          .filter((node) => statement.containsRange(node.getPos(), node.getEnd()))
          .map((node) => ({
            start: node.getStart() - start,
            end: node.getEnd() - start,
            text: registryParam,
          })),
      );
      const text = dedent(raw.replace(/^(?:[ \t]*\r?\n)+/, '').replace(/^[ \t]+/, ''));
      return text
        .split('\n')
        .map((line) => (line ? `    ${line}` : line))
        .join('\n');
    })
    .join('\n');
  const scene = [
    `import type { Registry } from "@nanoforge-dev/ecs/${side}";`,
    'import { EcsScene } from "@nanoforge-dev/ecs/scene";',
    ...packages,
    ...(relative.length ? ['', ...relative] : []),
    '',
    '/**',
    ` * The game as main made it: its entities and systems, loaded when the game starts.`,
    ' *',
    ' * @scene',
    ` * @side ${side}`,
    ' */',
    `export class ${className} extends EcsScene {`,
    `  override setup(${registryParam}: Registry) {`,
    setup,
    '  }',
    '}',
    '',
  ]
    .join('\n')
    .replace(/(import [^\n]+\n)(?=\/\*\*)/, '$1\n');

  /** main without the moved statements (nor `const registry = …` once unused), with SceneLibrary. */
  const edits: { start: number; end: number; text: string }[] = moved.map((statement) => ({
    start: ownStart(statements, statement),
    end: trailingEnd(statement),
    text: '',
  }));
  const registryStatement = registryDeclaration?.getFirstAncestorByKind(
    SyntaxKind.VariableStatement,
  );
  if (
    registryStatement &&
    statements.includes(registryStatement) &&
    !statements.some(
      (statement) =>
        statement !== registryStatement &&
        !moved.includes(statement) &&
        statement
          .getDescendantsOfKind(SyntaxKind.Identifier)
          .some((identifier) => identifier.getSymbol() === registryNode.getSymbol()),
    )
  )
    edits.push({
      start: ownStart(statements, registryStatement),
      end: trailingEnd(registryStatement),
      text: '',
    });
  const kept = file.getStatements().filter((statement) => !Node.isImportDeclaration(statement));
  const usedOutside = (node: Node) =>
    kept.some((statement) =>
      statement
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some(
          (identifier) =>
            identifier.getSymbol() === node.getSymbol() &&
            identifier.getText() === node.getText() &&
            !insideMoved(identifier),
        ),
    );
  for (const declaration of file.getImportDeclarations()) {
    const bindings = bindingsOf(declaration);
    if (!bindings.length) continue;
    const used = bindings.filter((binding) => usedOutside(binding.node));
    if (used.length === bindings.length) continue;
    edits.push({
      start: used.length
        ? declaration.getStart()
        : removalStart(context.text, declaration.getStart()),
      end: declaration.getEnd(),
      text: used.length ? importLine(declaration.getModuleSpecifierValue(), used, quote) : '',
    });
  }
  const uses = statements.filter(
    (statement) =>
      Node.isExpressionStatement(statement) && /^\s*app\.use\(/.test(statement.getText()),
  );
  const lastUse = uses.at(-1);
  if (!lastUse)
    throw new CodeError('main registers no library with app.use(…): add the SceneLibrary by hand.');
  const lineStart = context.text.lastIndexOf('\n', lastUse.getStart()) + 1;
  const indent = context.text.slice(lineStart, lastUse.getStart());
  edits.push({
    start: trailingEnd(lastUse),
    end: trailingEnd(lastUse),
    text: `\n${indent}app.use(new SceneLibrary({ initial: ${className}, scenes: { ${className} } }));`,
  });
  const imports = file.getImportDeclarations();
  const lastPackage = [...imports]
    .reverse()
    .find((declaration) => !declaration.getModuleSpecifierValue().startsWith('.'));
  const lastImport = imports.at(-1);
  edits.push({
    start: (lastPackage ?? lastImport)?.getEnd() ?? 0,
    end: (lastPackage ?? lastImport)?.getEnd() ?? 0,
    text: `\n${importLine('@nanoforge-dev/scene', [{ kind: 'named', imported: 'SceneLibrary', local: 'SceneLibrary', typeOnly: false, node: file }], quote)}`,
  });
  const relativeLeft = imports.some(
    (declaration) =>
      declaration.getModuleSpecifierValue().startsWith('.') &&
      bindingsOf(declaration).some((binding) => usedOutside(binding.node)),
  );
  edits.push({
    start: lastImport?.getEnd() ?? 0,
    end: lastImport?.getEnd() ?? 0,
    text: `\n${relativeLeft ? '' : '\n'}${importLine(context.moduleSpecifier(scenePath, context.path), [{ kind: 'named', imported: className, local: className, typeOnly: false, node: file }], quote)}`,
  });
  const mainText = `${applyEdits(context.text, edits)
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
  return {
    scene,
    main: mainText,
    entities: moved
      .filter((statement) => Node.isVariableStatement(statement))
      .map((statement) =>
        (statement as Statement & { getDeclarations(): { getName(): string }[] })
          .getDeclarations()[0]!
          .getName(),
      ),
    systems: moved
      .filter((statement) => registryCall(statement)!.method === 'addSystem')
      .map((statement) =>
        (registryCall(statement)!.call as Node).getText().replace(/^.*addSystem\(|\)$/g, ''),
      ),
  };
};
