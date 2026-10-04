import { Node, SyntaxKind } from 'ts-morph';

import type { ItemOwner, OwnerInput } from '@nanoforge-dev/editor-sdk/worker';

import manifest from '../../nanoforge.manifest.json';
import type { EcsItemData } from '../model/ecs-model.type';

/** Registry methods whose component arguments are what a system reads. */
const QUERY_METHODS = new Set(['getZipper', 'getIndexedZipper']);
const SINGLE_QUERY_METHODS = new Set(['getComponents', 'getComponentsConst']);

/** The literal of the class's `name = "X"` field, the ECS registry key. */
const registryName = (input: OwnerInput): string | undefined => {
  const { declaration } = input;
  if (!Node.isClassDeclaration(declaration)) return undefined;
  const initializer = declaration.getProperty('name')?.getInitializer();
  if (!initializer) return undefined;
  if (Node.isStringLiteral(initializer)) return initializer.getLiteralValue();
  const text = initializer.getText().replace(/\s+/g, '');
  const className = declaration.getName();
  if (className && (text === 'this.constructor.name' || text === `${className}.name`))
    return className;
  return undefined;
};

/** The function node of a system: the function itself, or an arrow/function const. */
const systemFunction = (input: OwnerInput) => {
  const { declaration } = input;
  if (Node.isFunctionDeclaration(declaration)) return declaration;
  const initializer = Node.isVariableDeclaration(declaration)
    ? declaration.getInitializer()
    : undefined;
  return initializer &&
    (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
    ? initializer
    : undefined;
};

const words = (texts: readonly string[] | undefined) =>
  (texts ?? []).flatMap((text) => text.split(/[\s,]+/)).filter(Boolean);

/** What a system reads (`getZipper([A, B])` → `[A, B]`), and the `ctx` libraries it uses. */
const systemData = (input: OwnerInput): EcsItemData => {
  const fn = systemFunction(input);
  const { context, tags } = input;
  const query: string[][] = [];
  const uses = new Set<string>();
  if (fn) {
    const ctx = fn.getParameters()[1]?.getName();
    for (const call of fn.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression();
      if (!Node.isPropertyAccessExpression(callee)) continue;
      const method = callee.getName();
      const [first] = call.getArguments();
      if (QUERY_METHODS.has(method) && first && Node.isArrayLiteralExpression(first)) {
        query.push(
          first.getElements().map((element) => context.refOf(element) ?? element.getText()),
        );
      } else if (SINGLE_QUERY_METHODS.has(method) && first) {
        query.push([context.refOf(first) ?? first.getText()]);
      }
    }
    if (ctx) {
      for (const access of fn.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
        const target = access.getExpression();
        if (Node.isIdentifier(target) && target.getText() === ctx) uses.add(access.getName());
      }
    }
  }
  const queryTags = tags.query;
  if (queryTags?.length) {
    const byName = new Map<string, string>();
    for (const identifier of context.file.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const ref = context.refOf(identifier);
      if (ref) byName.set(identifier.getText(), ref);
    }
    query.splice(
      0,
      query.length,
      ...queryTags.map((text) => words([text]).map((name) => byName.get(name) ?? name)),
    );
  }
  const usesTags = words(tags.uses);
  return {
    type: 'system',
    query,
    uses: usesTags.length ? usesTags : [...uses].sort(),
  };
};

/**
 * `@nanoforge/ecs` item data (ADR 0003): components (`@component`, or classes with a literal
 * `name` field in a components folder) and systems (`@system`, or functions in a systems folder).
 */
export const ecsOwner: ItemOwner = {
  name: manifest.name,
  version: manifest.version,
  schema: manifest.contributes.itemOwner.schema,
  tags: manifest.contributes.itemOwner.tags,
  infer: (input) => {
    if (input.context.folder === 'components') return registryName(input) !== undefined;
    if (input.context.folder === 'systems') return systemFunction(input) !== undefined;
    return false;
  },
  claims: (input) =>
    systemFunction(input) && !input.tags.component
      ? {
          params: systemFunction(input)!
            .getParameters()
            .map((param) => param.getName()),
        }
      : { fields: ['name'] },
  extract: (input) => {
    if (input.tags.system || (!input.tags.component && systemFunction(input))) {
      return systemFunction(input)
        ? { ...systemData(input), ...(!input.tags.system && { inferred: true }) }
        : undefined;
    }
    if (!Node.isClassDeclaration(input.declaration)) return undefined;
    const data: EcsItemData = {
      type: 'component',
      name: registryName(input) ?? input.declaration.getName() ?? 'Component',
      ...(!input.tags.component && { inferred: true }),
    };
    return { ...data };
  },
};
