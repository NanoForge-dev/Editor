import {
  type ClassDeclaration,
  type Node,
  Node as NodeGuards,
  type PropertyDeclaration,
  ts,
} from 'ts-morph';

import { tagTexts } from '../doc/doc-comment';
import type { Doc } from '../doc/doc.type';
import type { Element } from '../schema/element.schema';
import { defaultOf } from '../type/default-of';
import { constructorOf } from './exported-declarations';

/** `@asset <param> .png .jpg` of a constructor doc, or `@asset .png` of a param's own doc. */
export const assetTags = (doc: Doc, own: boolean): Map<string, string[]> => {
  const result = new Map<string, string[]>();
  for (const text of tagTexts(doc, 'asset')) {
    const words = text.split(/\s+/).filter(Boolean);
    const target = own ? '' : words.shift();
    if (target === undefined) continue;
    result.set(
      target,
      words.filter((word) => word.startsWith('.')),
    );
  }
  return result;
};

export const withDefault = (element: Element, initializer: Node | undefined): Element => {
  if (!initializer) return element;
  const value = defaultOf(initializer);
  if ('code' in value) return { ...element, defaultCode: value.code };
  const matches =
    (typeof value.value === 'string' && (element.type === 'string' || element.type === 'asset')) ||
    (typeof value.value === 'number' && element.type === 'number') ||
    (typeof value.value === 'boolean' && element.type === 'boolean') ||
    (Array.isArray(value.value) && element.type === 'array') ||
    (typeof value.value === 'object' &&
      value.value !== null &&
      !Array.isArray(value.value) &&
      element.type === 'object');
  return matches
    ? ({ ...element, default: value.value } as Element)
    : { ...element, defaultCode: initializer.getText() };
};

export const asAsset = (element: Element, accept: readonly string[]): Element => {
  if (element.type !== 'string') return element;
  const rest: Record<string, unknown> = { ...element };
  delete rest.enum;
  delete rest.enumRef;
  delete rest.enumMembers;
  return { ...rest, type: 'asset', ...(accept.length && { accept: [...accept] }) } as Element;
};

/** Fields assigned from constructor params (`this.x = x`): they are params, not fields. */
export const fieldsSetFromConstructor = (declaration: ClassDeclaration): Set<string> => {
  const constructor = constructorOf(declaration);
  const names = new Set<string>();
  if (!constructor) return names;
  const params = new Set(constructor.getParameters().map((param) => param.getName()));
  for (const statement of constructor.getStatements()) {
    if (!NodeGuards.isExpressionStatement(statement)) continue;
    const expression = statement.getExpression();
    if (!NodeGuards.isBinaryExpression(expression)) continue;
    if (expression.getOperatorToken().getKind() !== ts.SyntaxKind.EqualsToken) continue;
    const left = expression.getLeft();
    const right = expression.getRight();
    if (
      NodeGuards.isPropertyAccessExpression(left) &&
      NodeGuards.isThisExpression(left.getExpression()) &&
      NodeGuards.isIdentifier(right) &&
      params.has(right.getText())
    )
      names.add(left.getName());
  }
  return names;
};

export const isPublicInstanceField = (property: PropertyDeclaration) =>
  !property.isStatic() &&
  !property.hasModifier(ts.SyntaxKind.PrivateKeyword) &&
  !property.hasModifier(ts.SyntaxKind.ProtectedKeyword) &&
  !property.getName().startsWith('#');

export const packageOfSpecifier = (specifier: string): string | undefined => {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.includes(':'))
    return undefined;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};
