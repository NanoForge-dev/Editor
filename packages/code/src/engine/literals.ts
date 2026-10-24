import { type Expression, Node, type SourceFile, SyntaxKind } from 'ts-morph';

import { CodeError } from './code.exception';

export type LiteralValue =
  | string
  | number
  | boolean
  | null
  | readonly LiteralValue[]
  | { readonly [key: string]: LiteralValue };

const unwrap = (node: Node): Node => {
  let current = node;
  while (
    Node.isParenthesizedExpression(current) ||
    Node.isAsExpression(current) ||
    Node.isSatisfiesExpression(current) ||
    Node.isTypeAssertion(current)
  ) {
    current = current.getExpression();
  }
  return current;
};

/** Value of a literal expression; throws `CodeError` (with position) for anything else. */
export const literalToValue = (expression: Node): LiteralValue => {
  const node = unwrap(expression);
  const fail = (): never => {
    throw new CodeError(
      `Only literal values are supported here, found \`${node.getText().slice(0, 60)}\``,
      node.getSourceFile().getFilePath(),
      node.getStart(),
    );
  };
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    return node.getLiteralValue();
  if (Node.isNumericLiteral(node)) return node.getLiteralValue();
  if (Node.isTrueLiteral(node)) return true;
  if (Node.isFalseLiteral(node)) return false;
  if (Node.isNullLiteral(node)) return null;
  if (Node.isPrefixUnaryExpression(node)) {
    const operand = node.getOperand();
    if (!Node.isNumericLiteral(operand)) return fail();
    const value = operand.getLiteralValue();
    if (node.getOperatorToken() === SyntaxKind.MinusToken) return -value;
    if (node.getOperatorToken() === SyntaxKind.PlusToken) return value;
  }
  if (Node.isArrayLiteralExpression(node))
    return node.getElements().map((element) => literalToValue(element));
  if (Node.isObjectLiteralExpression(node)) {
    const result: Record<string, LiteralValue> = {};
    for (const property of node.getProperties()) {
      if (!Node.isPropertyAssignment(property)) return fail();
      const name = property.getNameNode();
      const key =
        Node.isIdentifier(name) || Node.isStringLiteral(name) || Node.isNumericLiteral(name)
          ? String(Node.isIdentifier(name) ? name.getText() : name.getLiteralValue())
          : fail();
      result[key] = literalToValue(property.getInitializerOrThrow());
    }
    return result;
  }
  return fail();
};

export interface PrintOptions {
  readonly quote?: '"' | "'";
  /** Indentation of the line the literal starts on. */
  readonly indent?: string;
  /** Indentation unit. */
  readonly tab?: string;
  /** Objects/arrays longer than this are printed on several lines. */
  readonly maxInline?: number;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Source code of a value (the inverse of `literalToValue`). */
export const valueToLiteral = (value: LiteralValue, options: PrintOptions = {}): string => {
  const quote = options.quote ?? "'";
  const tab = options.tab ?? '  ';
  const maxInline = options.maxInline ?? 60;
  const string = (text: string) =>
    quote +
    text
      .replace(/\\/g, '\\\\')
      .replace(new RegExp(quote, 'g'), `\\${quote}`)
      .replace(/\n/g, '\\n') +
    quote;
  const print = (current: LiteralValue, indent: string): string => {
    if (current === null) return 'null';
    if (typeof current === 'string') return string(current);
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new CodeError(`Cannot write ${current} as a literal`);
      return String(current);
    }
    if (typeof current === 'boolean') return String(current);
    const inner = indent + tab;
    if (Array.isArray(current)) {
      const items = (current as readonly LiteralValue[]).map((item) => print(item, inner));
      const inline = `[${items.join(', ')}]`;
      return inline.length <= maxInline && !inline.includes('\n')
        ? inline
        : `[\n${items.map((item) => inner + item).join(',\n')},\n${indent}]`;
    }
    const entries = Object.entries(current as Record<string, LiteralValue>).map(
      ([key, item]) => `${IDENTIFIER.test(key) ? key : string(key)}: ${print(item, inner)}`,
    );
    if (!entries.length) return '{}';
    const inline = `{ ${entries.join(', ')} }`;
    return inline.length <= maxInline && !inline.includes('\n')
      ? inline
      : `{\n${entries.map((entry) => inner + entry).join(',\n')},\n${indent}}`;
  };
  return print(value, options.indent ?? '');
};

/** Quote style of a file (the first string literal), for code that blends in. */
export const quoteStyle = (file: SourceFile): '"' | "'" => {
  const first = file.getFirstDescendantByKind(SyntaxKind.StringLiteral);
  return first?.getText().startsWith('"') ? '"' : "'";
};

/** Value of `export const <name> = <literal>` (e.g. `EDITOR_COMPONENT_MANIFEST`). */
export const readExportedLiteral = (file: SourceFile, name: string): LiteralValue | undefined => {
  const declaration = file.getVariableDeclaration(name);
  if (!declaration || !declaration.isExported()) return undefined;
  const initializer = declaration.getInitializer();
  if (!initializer)
    throw new CodeError(`${name} has no value`, file.getFilePath(), declaration.getStart());
  return literalToValue(initializer as Expression);
};
