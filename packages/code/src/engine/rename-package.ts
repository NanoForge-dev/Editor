import { Node, SyntaxKind } from 'ts-morph';

import type { TransformContext } from './code-engine.type';

/** Whether a string literal is the module of an import, an export, `import()` or `require()`. */
const isModuleSpecifier = (node: Node): boolean => {
  const parent = node.getParent();
  if (!parent) return false;
  if (Node.isImportDeclaration(parent) || Node.isExportDeclaration(parent))
    return parent.getModuleSpecifier() === node;
  if (Node.isExternalModuleReference(parent)) return true;
  if (Node.isLiteralTypeNode(parent)) return Node.isImportTypeNode(parent.getParent());
  if (Node.isCallExpression(parent)) {
    const callee = parent.getExpression();
    return (
      parent.getArguments()[0] === node &&
      (callee.getKind() === SyntaxKind.ImportKeyword ||
        (Node.isIdentifier(callee) && callee.getText() === 'require'))
    );
  }
  return false;
};

/** Points the module specifiers of package `from` (and its sub-paths) at `to`. */
export const renamePackage = (context: TransformContext, op: unknown): void => {
  const { from, to } = op as { from: string; to: string };
  for (const literal of context.file.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
    const value = literal.getLiteralValue();
    if (value !== from && !value.startsWith(`${from}/`)) continue;
    if (!isModuleSpecifier(literal)) continue;
    const quote = literal.getText()[0];
    context.edit.replace(literal, `${quote}${to}${value.slice(from.length)}${quote}`);
  }
};
