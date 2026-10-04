import {
  type ClassDeclaration,
  type Node,
  Node as NodeGuards,
  type ParameterDeclaration,
  type SourceFile,
} from 'ts-morph';

import type { Doc } from '../doc/doc.type';
import type { ItemDeclaration, ItemKind } from '../owner/item-owner.type';

type Tags = Record<string, string[]>;

export const tagsByName = (doc: Doc): Tags => {
  const result: Tags = {};
  for (const tag of doc.tags) (result[tag.name] ??= []).push(tag.text);
  return result;
};

/** The export declarations of the file itself (not re-exports), with their export name. */
interface ExportedItem {
  readonly exportName: string;
  readonly declaration: ItemDeclaration;
  readonly kind: ItemKind;
}

export const exportedDeclarations = (file: SourceFile): ExportedItem[] =>
  [...file.getExportedDeclarations()].flatMap(([exportName, declarations]) =>
    declarations.flatMap((declaration): ExportedItem[] => {
      if (declaration.getSourceFile() !== file) return [];
      if (NodeGuards.isClassDeclaration(declaration))
        return [{ exportName, declaration, kind: 'class' as ItemKind }];
      if (NodeGuards.isFunctionDeclaration(declaration))
        return [{ exportName, declaration, kind: 'function' as ItemKind }];
      if (NodeGuards.isVariableDeclaration(declaration))
        return [{ exportName, declaration, kind: 'const' as ItemKind }];
      return [];
    }),
  );

export const docNodeOf = (declaration: ItemDeclaration): Node =>
  NodeGuards.isVariableDeclaration(declaration)
    ? (declaration.getVariableStatement() ?? declaration)
    : declaration;

/** The constructor that has a body (the implementation), or the first one. */
export const constructorOf = (declaration: ClassDeclaration) => {
  const constructors = declaration.getConstructors();
  return constructors.find((constructor) => constructor.hasBody()) ?? constructors[0];
};

/** Parameters of the item: its constructor's (class), its own (function, arrow const). */
export const parametersOf = (declaration: ItemDeclaration): ParameterDeclaration[] => {
  if (NodeGuards.isClassDeclaration(declaration))
    return constructorOf(declaration)?.getParameters() ?? [];
  if (NodeGuards.isFunctionDeclaration(declaration)) return declaration.getParameters();
  const initializer = declaration.getInitializer();
  if (
    initializer &&
    (NodeGuards.isArrowFunction(initializer) || NodeGuards.isFunctionExpression(initializer))
  )
    return initializer.getParameters();
  return [];
};
