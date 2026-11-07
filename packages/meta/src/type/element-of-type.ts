import { Node, type Type, ts } from 'ts-morph';

import type { Element, EnumMember } from '../schema/element.schema';
import type { TypeContext } from './type-context.type';

const exportRef = (declaration: Node, name: string, context: TypeContext) =>
  `${context.modulePath(declaration.getSourceFile())}#${name}`;

/** The parts of a type that hold a value: `undefined` and `null` only make it optional. */
const valueParts = (type: Type): Type[] =>
  type.isUnion()
    ? type.getUnionTypes().filter((part) => !part.isUndefined() && !part.isNull())
    : [type];

/** The enum of a type, from its members (`Mode`, `Mode | undefined`) or the type itself. */
const enumOf = (parts: readonly Type[]): { symbolName: string; declaration: Node } | undefined => {
  const [first] = parts;
  const symbol =
    parts.length > 1
      ? first?.getSymbol()?.getDeclarations()[0]?.getParent()?.getSymbol()
      : (first?.getSymbol() ?? first?.getAliasSymbol());
  const declaration = symbol?.getDeclarations()[0];
  if (!symbol || !declaration || !Node.isEnumDeclaration(declaration)) return undefined;
  return { symbolName: symbol.getName(), declaration };
};

const enumMembers = (declaration: Node): EnumMember[] =>
  Node.isEnumDeclaration(declaration)
    ? declaration.getMembers().flatMap((member) => {
        const value = member.getValue();
        return value === undefined ? [] : [{ name: member.getName(), value }];
      })
    : [];

/** A class (or interface) declared in a package or the project, as `{ type: 'ref' }`. */
const refOf = (type: Type, context: TypeContext): string | undefined => {
  const symbol = type.getSymbol() ?? type.getAliasSymbol();
  const declaration = symbol?.getDeclarations()[0];
  if (!symbol || !declaration) return undefined;
  if (!Node.isClassDeclaration(declaration) && !Node.isInterfaceDeclaration(declaration))
    return undefined;
  return exportRef(declaration, symbol.getName(), context);
};

/**
 * The `Element` of a TypeScript type (a param, a field, an array item). `node` is where the type
 * is used, for its text when nothing fits.
 */
export const elementOfType = (
  name: string,
  rawType: Type,
  node: Node,
  context: TypeContext,
  depth = 0,
): Element => {
  const parts = valueParts(rawType);
  const type = parts.length === 1 ? parts[0]! : rawType;

  const enumInfo = enumOf(parts);
  if (enumInfo) {
    const members = enumMembers(enumInfo.declaration);
    const numeric =
      members.length > 0 && members.every((member) => typeof member.value === 'number');
    return {
      type: numeric ? 'number' : 'string',
      name,
      enumRef: exportRef(enumInfo.declaration, enumInfo.symbolName, context),
      enumMembers: members,
    };
  }
  if (
    type.isBoolean() ||
    type.isBooleanLiteral() ||
    (parts.length > 1 && parts.every((part) => part.isBooleanLiteral()))
  )
    return { type: 'boolean', name };
  if (type.isNumber() || type.isNumberLiteral()) return { type: 'number', name };
  if (type.isString() || type.isStringLiteral() || type.isTemplateLiteral()) {
    return type.isStringLiteral()
      ? { type: 'string', name, enum: [type.getLiteralValue() as string] }
      : { type: 'string', name };
  }
  if (parts.length > 1 && parts.every((part) => part.isStringLiteral())) {
    return { type: 'string', name, enum: parts.map((part) => part.getLiteralValue() as string) };
  }
  if (type.isArray() && depth < 4) {
    return {
      type: 'array',
      name,
      items: elementOfType('item', type.getArrayElementTypeOrThrow(), node, context, depth + 1),
    };
  }
  const ref = refOf(type, context);
  if (ref) return { type: 'ref', name, ref };
  if (type.isObject() && type.isAnonymous() && depth < 4) {
    return {
      type: 'object',
      name,
      properties: type
        .getProperties()
        .map((property) =>
          elementOfType(
            property.getName(),
            property.getTypeAtLocation(node),
            node,
            context,
            depth + 1,
          ),
        ),
    };
  }
  return {
    type: 'unknown',
    name,
    tsType: type.getText(node, ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope),
  };
};
