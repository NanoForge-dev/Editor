import { Node, SyntaxKind } from 'ts-morph';

import type { AnalyzeContext } from '@nanoforge-dev/editor-sdk/worker';

/** Components and systems the analyzed file declares itself and uses. */
export interface LocalItems {
  readonly components: readonly string[];
  readonly systems: readonly string[];
}

/**
 * Top-level classes of the analyzed file used as components (`addComponent(entity, new X(…))`)
 * and functions used as systems (`addSystem(x)`): items defined in an entry file, which the
 * catalog (component and system files only) does not list.
 */
export const analyzeLocalItems = (context: AnalyzeContext): LocalItems => {
  const components = new Set<string>();
  const systems = new Set<string>();
  const local = (node: Node | undefined) => {
    if (!node || !Node.isIdentifier(node)) return undefined;
    const declaration = node.getSymbol()?.getDeclarations()[0];
    if (!declaration || declaration.getSourceFile() !== context.file) return undefined;
    const top = Node.isVariableDeclaration(declaration)
      ? declaration.getVariableStatement()
      : declaration;
    return top && Node.isSourceFile(top.getParent()) ? node.getText() : undefined;
  };
  for (const call of context.file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) continue;
    const [first, second] = call.getArguments();
    if (callee.getName() === 'addComponent' && second && Node.isNewExpression(second)) {
      const name = local(second.getExpression());
      if (name) components.add(name);
    }
    if (callee.getName() === 'addSystem') {
      const name = local(first);
      if (name) systems.add(name);
    }
  }
  return { components: [...components].sort(), systems: [...systems].sort() };
};
