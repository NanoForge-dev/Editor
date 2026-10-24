import {
  type Block,
  type CallExpression,
  type ExpressionStatement,
  Node,
  type PropertyAccessExpression,
  type SourceFile,
  SyntaxKind,
  type VariableStatement,
} from 'ts-morph';

import type { AnalyzeContext } from '@nanoforge-dev/editor-sdk/worker';

import type {
  ArgModel,
  CodeOnlyEntity,
  ComponentUse,
  EntityModel,
  EntryAnalyzeArgs,
  EntryModel,
  EntryRoot,
  EntryScope,
  SystemUse,
} from '../model/ecs-model.type';
import { scopeName } from '../model/scope-name';

/** The body of `export const main = async (…) => { … }` or `export function main(…) { … }`. */
export const findMain = (file: SourceFile): Block | undefined => {
  const fn = file.getFunction('main');
  if (fn?.isExported()) return fn.getBody() as Block | undefined;
  const variable = file.getVariableDeclaration('main');
  const initializer = variable?.getInitializer();
  if (
    variable?.isExported() &&
    initializer &&
    (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
  ) {
    const body = initializer.getBody();
    return Node.isBlock(body) ? body : undefined;
  }
  return undefined;
};

/** The body of a scope: `main`, or a method of a class of the file (`Level1.setup`). */
export const findBody = (file: SourceFile, scope: EntryScope | undefined): Block | undefined => {
  if (scope?.kind !== 'method') return findMain(file);
  const body = file.getClass(scope.class)?.getMethod(scope.method)?.getBody();
  return body && Node.isBlock(body) ? body : undefined;
};

/** A method's first parameter: the registry a scene's `setup(registry, ctx)` gets. */
const registryParameter = (body: Block): string | undefined => {
  const method = body.getParent();
  if (!method || !Node.isMethodDeclaration(method)) return undefined;
  const first = method.getParameters()[0];
  return first && Node.isIdentifier(first.getNameNode()) ? first.getName() : undefined;
};

/** `<receiver>.<method>(…)` of an expression, if it is that call. */
const methodCall = (node: Node | undefined, method: string): CallExpression | undefined => {
  if (!node || !Node.isCallExpression(node)) return undefined;
  const callee = node.getExpression();
  return Node.isPropertyAccessExpression(callee) && callee.getName() === method ? node : undefined;
};

const receiverOf = (call: CallExpression) =>
  (call.getExpression() as PropertyAccessExpression).getExpression().getText();

export interface ParsedEntity {
  readonly name: string;
  readonly declaration: VariableStatement;
  readonly components: ExpressionStatement[];
}

/** What the analyzer and the transformers see of an entry file. */
export interface ParsedEntry {
  readonly main: Block;
  readonly registry?: string;
  readonly entities: ParsedEntity[];
  readonly systems: ExpressionStatement[];
  /** `spawnEntity()` calls that aren't `const x = registry.spawnEntity();` in `main`. */
  readonly codeOnly: CallExpression[];
}

export const parseEntry = (file: SourceFile, scope?: EntryScope): ParsedEntry | undefined => {
  const main = findBody(file, scope);
  if (!main) return undefined;
  const spawns = main
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => methodCall(call, 'spawnEntity'));
  const registry = spawns[0]
    ? receiverOf(spawns[0])
    : (registryVariable(main) ?? registryParameter(main));

  const entities: ParsedEntity[] = [];
  const byName = new Map<string, ParsedEntity>();
  const systems: ExpressionStatement[] = [];
  const modeled = new Set<CallExpression>();
  for (const statement of main.getStatements()) {
    if (Node.isVariableStatement(statement)) {
      const [declaration, ...others] = statement.getDeclarations();
      const spawn = methodCall(declaration?.getInitializer(), 'spawnEntity');
      if (
        declaration &&
        !others.length &&
        spawn &&
        !spawn.getArguments().length &&
        receiverOf(spawn) === registry &&
        Node.isIdentifier(declaration.getNameNode())
      ) {
        const entity = { name: declaration.getName(), declaration: statement, components: [] };
        entities.push(entity);
        byName.set(entity.name, entity);
        modeled.add(spawn);
      }
      continue;
    }
    if (!Node.isExpressionStatement(statement)) continue;
    const expression = statement.getExpression();
    const add = methodCall(expression, 'addComponent');
    if (add && receiverOf(add) === registry) {
      const [target] = add.getArguments();
      const entity = target && Node.isIdentifier(target) ? byName.get(target.getText()) : undefined;
      if (entity && add.getArguments().length === 2) entity.components.push(statement);
      continue;
    }
    const system = methodCall(expression, 'addSystem');
    if (system && receiverOf(system) === registry && system.getArguments().length === 1)
      systems.push(statement);
  }
  return {
    main,
    ...(registry && { registry }),
    entities,
    systems,
    codeOnly: spawns.filter((call) => !modeled.has(call)),
  };
};

/** `const registry = ecs.registry` (or any `… = <x>.registry`). */
const registryVariable = (main: Block): string | undefined => {
  for (const statement of main.getStatements()) {
    if (!Node.isVariableStatement(statement)) continue;
    for (const declaration of statement.getDeclarations()) {
      const initializer = declaration.getInitializer();
      if (
        initializer &&
        Node.isPropertyAccessExpression(initializer) &&
        initializer.getName() === 'registry'
      )
        return declaration.getName();
    }
  }
  return undefined;
};

/** `new X(...)` of an `addComponent` statement. */
export const componentExpression = (statement: ExpressionStatement): Node =>
  (statement.getExpression() as CallExpression).getArguments()[1]!;

/** The item a class or function identifier refers to, and its file. */
const itemOf = (node: Node, roots: readonly EntryRoot[]): { source?: string; item?: string } => {
  let symbol = node.getSymbol();
  if (symbol?.isAlias()) symbol = symbol.getAliasedSymbol();
  const declaration = symbol?.getDeclarations()[0];
  if (!symbol || !declaration) return {};
  const path = declaration
    .getSourceFile()
    .getFilePath()
    .replace(/^\/project\//, '');
  const exportable = Node.isVariableDeclaration(declaration)
    ? declaration.getVariableStatement()
    : declaration;
  const exported = !!exportable && Node.isExportable(exportable) && exportable.isExported();
  const root = [...roots]
    .sort((a, b) => b.path.length - a.path.length)
    .find((candidate) => candidate.path === '' || path.startsWith(`${candidate.path}/`));
  return {
    source: path,
    ...(exported && root && { item: `${root.ref}#${symbol.getName()}` }),
  };
};

const argValue = (context: AnalyzeContext, node: Node): unknown => {
  try {
    return context.literals.literalToValue(node);
  } catch {
    if (Node.isPropertyAccessExpression(node)) {
      const value = node
        .getProject()
        .getTypeChecker()
        .compilerObject.getConstantValue(node.compilerNode);
      if (value !== undefined) return value;
    }
    return undefined;
  }
};

const componentUse = (
  context: AnalyzeContext,
  statement: ExpressionStatement,
  roots: readonly EntryRoot[],
): ComponentUse => {
  const expression = componentExpression(statement);
  const base = { node: context.ref(statement), code: expression.getText() };
  if (!Node.isNewExpression(expression) || !Node.isIdentifier(expression.getExpression()))
    return { ...base, args: [], editable: false };
  const identifier = expression.getExpression();
  const args: ArgModel[] = (expression.getArguments() as Node[]).map((arg) => {
    const value = argValue(context, arg);
    const construct =
      Node.isNewExpression(arg) && Node.isIdentifier(arg.getExpression())
        ? {
            className: arg.getExpression().getText(),
            args: (arg.getArguments() as Node[]).map((inner) => argValue(context, inner) ?? null),
          }
        : undefined;
    return {
      code: arg.getText(),
      start: arg.getStart(),
      end: arg.getEnd(),
      ...(value !== undefined && { value }),
      ...(construct && { construct }),
    };
  });
  return {
    ...base,
    className: identifier.getText(),
    ...itemOf(identifier, roots),
    args,
    editable: true,
  };
};

const lineOf = (node: Node) => node.getStartLineNumber();

/** The entities, their components, the systems and the read-only parts of an entry file. */
export const analyzeEntry = (context: AnalyzeContext, rawArgs: unknown): EntryModel => {
  const args = (rawArgs ?? { roots: [] }) as EntryAnalyzeArgs;
  const parsed = parseEntry(context.file, args.scope);
  if (!parsed) {
    return {
      path: context.path,
      found: false,
      entities: [],
      codeOnly: [],
      systems: [],
      problems: [
        args.scope?.kind === 'method'
          ? `No \`${scopeName(args.scope)}\` method in this file.`
          : 'No exported `main` function in this file.',
      ],
    };
  }
  const entities: EntityModel[] = parsed.entities.map((entity) => ({
    name: entity.name,
    node: context.ref(entity.declaration),
    line: lineOf(entity.declaration),
    components: entity.components.map((statement) => componentUse(context, statement, args.roots)),
  }));
  const codeOnly: CodeOnlyEntity[] = parsed.codeOnly.map((call) => {
    const statement =
      call.getFirstAncestor((node) => Node.isStatement(node) && node.getParent() === parsed.main) ??
      call;
    return {
      line: lineOf(call),
      start: statement.getStart(),
      end: statement.getEnd(),
      code: statement.getText(),
    };
  });
  const systems: SystemUse[] = parsed.systems.map((statement) => {
    const [fn] = (statement.getExpression() as CallExpression).getArguments();
    const name = fn && Node.isIdentifier(fn) ? fn.getText() : undefined;
    const item = fn && Node.isIdentifier(fn) ? itemOf(fn, args.roots).item : undefined;
    return {
      node: context.ref(statement),
      code: fn?.getText() ?? '',
      ...(name && { name }),
      ...(item && { item }),
    };
  });
  const problems: string[] = [];
  if (!parsed.registry)
    problems.push(
      `No ECS registry found in \`${scopeName(args.scope)}\` (\`registry.spawnEntity()\`).`,
    );
  return {
    path: context.path,
    found: true,
    ...(parsed.registry && { registry: parsed.registry }),
    entities,
    codeOnly,
    systems,
    problems,
  };
};
