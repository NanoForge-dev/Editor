import { Node, type Type, ts } from 'ts-morph';

import type { Element, EnumMember } from '../schema/element.schema';
import type { TypeContext } from './type-context.type';

const exportRef = (declaration: Node, name: string, context: TypeContext) =>
  `${context.modulePath(declaration.getSourceFile())}#${name}`;

const enumOf = (type: Type): { symbolName: string; declaration: Node } | undefined => {
  const symbol = type.isUnion()
    ? type.getUnionTypes()[0]?.getSymbol()?.getDeclarations()[0]?.getParent()?.getSymbol()
    : (type.getSymbol() ?? type.getAliasSymbol());
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

const isStringLiteralUnion = (type: Type) =>
  type.isUnion() && type.getUnionTypes().every((part) => part.isStringLiteral());

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
  const type = rawType.isUnion()
    ? (() => {
        const parts = rawType.getUnionTypes().filter((part) => !part.isUndefined());
        return parts.length === 1 ? parts[0]! : rawType;
      })()
    : rawType;

  const enumInfo = enumOf(type);
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
  if (type.isBoolean() || type.isBooleanLiteral()) return { type: 'boolean', name };
  if (type.isNumber() || type.isNumberLiteral()) return { type: 'number', name };
  if (type.isString() || type.isStringLiteral() || type.isTemplateLiteral()) {
    return type.isStringLiteral()
      ? { type: 'string', name, enum: [type.getLiteralValue() as string] }
      : { type: 'string', name };
  }
  if (isStringLiteralUnion(type)) {
    return {
      type: 'string',
      name,
      enum: type.getUnionTypes().map((part) => part.getLiteralValue() as string),
    };
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
