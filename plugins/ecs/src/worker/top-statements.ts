import { Node, type Statement } from 'ts-morph';

/** The top-level statement a node belongs to. */
export const topStatement = (node: Node): Statement | undefined => {
  let current: Node | undefined = node;
  while (current && !Node.isSourceFile(current.getParent())) current = current.getParent();
  return current as Statement | undefined;
};

/** The names a top-level statement declares. */
export const declaredNames = (statement: Statement): string[] => {
  if (Node.isClassDeclaration(statement) || Node.isFunctionDeclaration(statement))
    return statement.getName() ? [statement.getName()!] : [];
  if (Node.isVariableStatement(statement))
    return statement.getDeclarations().map((declaration) => declaration.getName());
  if (Node.isInterfaceDeclaration(statement) || Node.isTypeAliasDeclaration(statement))
    return [statement.getName()];
  if (Node.isEnumDeclaration(statement)) return [statement.getName()];
  return [];
};

/** Whether a top-level statement is exported. */
export const isExported = (statement: Statement) =>
  Node.isExportable(statement) && statement.isExported();

/** The statement's text with its doc comment, exported, without the blank lines before it. */
export const movedText = (statement: Statement, exported = true) => {
  const full = statement.getFullText();
  const at = statement.getStart() - statement.getFullStart();
  const text =
    !exported || isExported(statement) ? full : `${full.slice(0, at)}export ${full.slice(at)}`;
  return text.replace(/^(?:[ \t]*\r?\n)+/, '').trimEnd();
};
