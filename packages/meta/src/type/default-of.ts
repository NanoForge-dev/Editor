import { Node, ts } from 'ts-morph';

export type DefaultValue =
  | { readonly value: string | number | boolean | null | unknown[] | Record<string, unknown> }
  | { readonly code: string };

/** The default of an initializer: a JSON value when it is a literal, else its code. */
export const defaultOf = (initializer: Node): DefaultValue => {
  const literal = literalValue(initializer);
  return literal === NOT_LITERAL ? { code: initializer.getText() } : { value: literal };
};

const NOT_LITERAL = Symbol('not a literal');
type Literal = string | number | boolean | null | Literal[] | { [key: string]: Literal };

const literalValue = (node: Node): Literal | typeof NOT_LITERAL => {
  if (
    Node.isParenthesizedExpression(node) ||
    Node.isAsExpression(node) ||
    Node.isSatisfiesExpression(node)
  )
    return literalValue(node.getExpression());
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    return node.getLiteralValue();
  if (Node.isNumericLiteral(node)) return node.getLiteralValue();
  if (Node.isTrueLiteral(node)) return true;
  if (Node.isFalseLiteral(node)) return false;
  if (Node.isNullLiteral(node)) return null;
  if (Node.isPrefixUnaryExpression(node)) {
    const operand = node.getOperand();
    if (Node.isNumericLiteral(operand)) {
      if (node.getOperatorToken() === ts.SyntaxKind.MinusToken) return -operand.getLiteralValue();
      if (node.getOperatorToken() === ts.SyntaxKind.PlusToken) return operand.getLiteralValue();
    }
    return NOT_LITERAL;
  }
  if (Node.isPropertyAccessExpression(node)) {
    const value = node
      .getProject()
      .getTypeChecker()
      .compilerObject.getConstantValue(node.compilerNode);
    if (value !== undefined) return value;
    const member = node.getSymbol()?.getDeclarations()[0];
    return member && Node.isEnumMember(member) ? (member.getValue() ?? NOT_LITERAL) : NOT_LITERAL;
  }
  if (Node.isArrayLiteralExpression(node)) {
    const values: Literal[] = [];
    for (const element of node.getElements()) {
      const value = literalValue(element);
      if (value === NOT_LITERAL) return NOT_LITERAL;
      values.push(value);
    }
    return values;
  }
  if (Node.isObjectLiteralExpression(node)) {
    const result: Record<string, Literal> = {};
    for (const property of node.getProperties()) {
      if (!Node.isPropertyAssignment(property)) return NOT_LITERAL;
      const value = literalValue(property.getInitializerOrThrow());
      if (value === NOT_LITERAL) return NOT_LITERAL;
      result[property.getName().replace(/^['"]|['"]$/g, '')] = value;
    }
    return result;
  }
  return NOT_LITERAL;
};
