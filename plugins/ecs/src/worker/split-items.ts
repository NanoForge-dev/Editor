import {
  type ImportDeclaration,
  Node,
  type SourceFile,
  type Statement,
  SyntaxKind,
} from 'ts-morph';

import { type AnalyzeContext, CodeError } from '@nanoforge-dev/editor-sdk/worker';

/** Items to move out of the analyzed file: export name → the new file's project path. */
export interface SplitItemsArgs {
  readonly items: readonly { readonly name: string; readonly to: string }[];
}

/** The texts a split leaves: new files, the file itself (null: it goes) and its importers. */
export interface SplitItemsResult {
  readonly files: readonly { readonly path: string; readonly text: string }[];
  readonly source: string | null;
  readonly importers: readonly { readonly path: string; readonly text: string }[];
}

const ROOT = '/project/';
const projectPath = (file: SourceFile) => file.getFilePath().replace(ROOT, '');

/** One binding an import brings: `{ a }`, `{ a as b }`, a default or a namespace. */
interface Binding {
  readonly kind: 'named' | 'default' | 'namespace';
  /** The exported name (named bindings). */
  readonly imported?: string;
  readonly local: string;
  readonly typeOnly: boolean;
}

/** Import lines in the file's quote style, grouped by module. */
const importLines = (needs: Map<string, Binding[]>, quote: string): string[] =>
  [...needs]
    .sort(([a], [b]) => Number(a.startsWith('.')) - Number(b.startsWith('.')))
    .map(([module, bindings]) => {
      const unique = [...new Map(bindings.map((binding) => [binding.local, binding])).values()];
      const allTypes = unique.every((binding) => binding.typeOnly);
      const parts: string[] = [];
      const def = unique.find((binding) => binding.kind === 'default');
      const namespace = unique.find((binding) => binding.kind === 'namespace');
      const named = unique
        .filter((binding) => binding.kind === 'named')
        .sort((a, b) => a.local.localeCompare(b.local))
        .map(
          (binding) =>
            `${binding.typeOnly && !allTypes ? 'type ' : ''}${binding.imported === binding.local ? binding.local : `${binding.imported} as ${binding.local}`}`,
        );
      if (def) parts.push(def.local);
      if (namespace) parts.push(`* as ${namespace.local}`);
      if (named.length) parts.push(`{ ${named.join(', ')} }`);
      return `import ${allTypes ? 'type ' : ''}${parts.join(', ')} from ${quote}${module}${quote};`;
    });

const bindingsOf = (declaration: ImportDeclaration): (Binding & { node: Node })[] => {
  const typeOnly = declaration.isTypeOnly();
  const bindings: (Binding & { node: Node })[] = [];
  const def = declaration.getDefaultImport();
  if (def) bindings.push({ kind: 'default', local: def.getText(), typeOnly, node: def });
  const namespace = declaration.getNamespaceImport();
  if (namespace)
    bindings.push({ kind: 'namespace', local: namespace.getText(), typeOnly, node: namespace });
  for (const specifier of declaration.getNamedImports()) {
    const local = specifier.getAliasNode() ?? specifier.getNameNode();
    bindings.push({
      kind: 'named',
      imported: specifier.getName(),
      local: local.getText(),
      typeOnly: typeOnly || specifier.isTypeOnly(),
      node: local,
    });
  }
  return bindings;
};

/** The top-level statement a node belongs to. */
const topStatement = (node: Node): Statement | undefined => {
  let current: Node | undefined = node;
  while (current && !Node.isSourceFile(current.getParent())) current = current.getParent();
  return current as Statement | undefined;
};

/** The names a top-level statement declares. */
const declaredNames = (statement: Statement): string[] => {
  if (Node.isClassDeclaration(statement) || Node.isFunctionDeclaration(statement))
    return statement.getName() ? [statement.getName()!] : [];
  if (Node.isVariableStatement(statement))
    return statement.getDeclarations().map((declaration) => declaration.getName());
  if (Node.isInterfaceDeclaration(statement) || Node.isTypeAliasDeclaration(statement))
    return [statement.getName()];
  if (Node.isEnumDeclaration(statement)) return [statement.getName()];
  return [];
};

const isExported = (statement: Statement) => Node.isExportable(statement) && statement.isExported();

/** The statement's text with its doc comment, exported, without the blank lines before it. */
const movedText = (statement: Statement, exported = true) => {
  const full = statement.getFullText();
  const at = statement.getStart() - statement.getFullStart();
  const text =
    !exported || isExported(statement) ? full : `${full.slice(0, at)}export ${full.slice(at)}`;
  return text.replace(/^(?:[ \t]*\r?\n)+/, '').trimEnd();
};

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}
const applyEdits = (text: string, edits: readonly Edit[]) => {
  let result = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start))
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  return result;
};
const tidy = (text: string) => `${text.replace(/\n{3,}/g, '\n\n').trim()}\n`;

/**
 * Moves top-level items (components, systems…) of the analyzed file to files of their own:
 * each takes only the imports it uses; what stays in the file and is used by a moved item is
 * exported and imported; the file keeps what it still uses, and its importers import each item
 * from its new file. Read-only: returns the texts.
 */
export const analyzeSplitItems = (context: AnalyzeContext, args: unknown): SplitItemsResult => {
  const { items } = args as SplitItemsArgs;
  const file = context.file;
  const path = context.path;
  const quote =
    file.getImportDeclarations()[0]?.getModuleSpecifier().getText()[0] ??
    (context.text.includes("'") && !context.text.includes('"') ? "'" : '"');
  const statements = file.getStatements();
  const targetOf = new Map(items.map((item) => [item.name, item.to]));
  const moved = new Map<Statement, string>();
  for (const { name, to } of items) {
    const statement = statements.find((candidate) => declaredNames(candidate).includes(name));
    if (!statement) throw new CodeError(`${name} is not declared at the top of ${path}.`);
    moved.set(statement, to);
  }
  /**
   * Helpers (top-level declarations) used only by items moving to one same file go with them,
   * as they were (not exported): the new file must not import them back from here.
   */
  const companions = new Set<Statement>();
  const references = (from: Statement, to: Statement) => {
    const names = declaredNames(to);
    return from.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => {
      if (!names.includes(identifier.getText())) return false;
      const declaration = identifier.getSymbol()?.getDeclarations()[0];
      return !!declaration && topStatement(declaration) === to;
    });
  };
  for (let changed = true; changed;) {
    changed = false;
    for (const helper of statements) {
      if (moved.has(helper) || Node.isImportDeclaration(helper) || !declaredNames(helper).length)
        continue;
      const users = statements.filter((user) => user !== helper && references(user, helper));
      const targets = new Set(users.map((user) => moved.get(user)));
      if (!users.length || targets.size !== 1 || targets.has(undefined)) continue;
      moved.set(helper, [...targets][0]!);
      companions.add(helper);
      changed = true;
    }
  }
  const movedOf = (statement: Statement | undefined) =>
    statement ? moved.get(statement) : undefined;
  const exportInFile = new Set<Statement>();

  /** What `node`'s identifiers refer to outside of `scope`: imports and top-level declarations. */
  const needsOf = (scope: Node, from: string, ownNames: readonly string[]) => {
    const needs = new Map<string, Binding[]>();
    const need = (module: string, binding: Binding) =>
      needs.set(module, [...(needs.get(module) ?? []), binding]);
    for (const identifier of scope.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const declaration = identifier.getSymbol()?.getDeclarations()[0];
      if (!declaration || declaration.getSourceFile() !== file) continue;
      if (scope.containsRange(declaration.getPos(), declaration.getEnd())) continue;
      const importDeclaration = declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
      if (importDeclaration) {
        const binding = bindingsOf(importDeclaration).find(
          (candidate) => candidate.local === identifier.getText(),
        );
        if (!binding) continue;
        const target = importDeclaration.getModuleSpecifierSourceFile();
        const value = importDeclaration.getModuleSpecifierValue();
        const module =
          value.startsWith('.') && target
            ? context.moduleSpecifier(projectPath(target), from)
            : value;
        need(module, binding);
        continue;
      }
      const statement = topStatement(declaration);
      if (!statement || !declaredNames(statement).includes(identifier.getText())) continue;
      if (ownNames.includes(identifier.getText())) continue;
      const to = movedOf(statement);
      if (to) {
        if (to !== from)
          need(context.moduleSpecifier(to, from), {
            kind: 'named',
            imported: identifier.getText(),
            local: identifier.getText(),
            typeOnly: false,
          });
        continue;
      }
      if (!isExported(statement)) exportInFile.add(statement);
      need(context.moduleSpecifier(path, from), {
        kind: 'named',
        imported: identifier.getText(),
        local: identifier.getText(),
        typeOnly: false,
      });
    }
    return needs;
  };

  const byTarget = new Map<string, Statement[]>();
  for (const [statement, to] of [...moved].sort(([a], [b]) => a.getPos() - b.getPos()))
    byTarget.set(to, [...(byTarget.get(to) ?? []), statement]);
  const files = [...byTarget].map(([to, group]) => {
    const own = group.flatMap(declaredNames);
    const needs = new Map<string, Binding[]>();
    for (const statement of group)
      for (const [module, bindings] of needsOf(statement, to, own))
        needs.set(module, [...(needs.get(module) ?? []), ...bindings]);
    const lines = importLines(needs, quote);
    const firstRelative = lines.findIndex((line) => / from ["']\./.test(line));
    const imports =
      firstRelative > 0
        ? [...lines.slice(0, firstRelative), '', ...lines.slice(firstRelative)]
        : lines;
    const body = group
      .map((statement) => movedText(statement, !companions.has(statement)))
      .join('\n\n');
    return { path: to, text: tidy(`${imports.join('\n')}${imports.length ? '\n\n' : ''}${body}`) };
  });

  /** The file without the moved items. */
  const edits: Edit[] = [];
  for (const statement of moved.keys())
    edits.push({ start: statement.getFullStart(), end: statement.getEnd(), text: '' });
  for (const statement of exportInFile)
    edits.push({ start: statement.getStart(), end: statement.getStart(), text: 'export ' });
  const kept = statements.filter(
    (statement) => !moved.has(statement) && !Node.isImportDeclaration(statement),
  );
  const usedOutsideMoved = (node: Node) =>
    kept.some((statement) =>
      statement
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some(
          (identifier) =>
            identifier.getText() === node.getText() && identifier.getSymbol() === node.getSymbol(),
        ),
    );
  for (const declaration of file.getImportDeclarations()) {
    const bindings = bindingsOf(declaration);
    if (!bindings.length) continue;
    const used = bindings.filter((binding) => usedOutsideMoved(binding.node));
    if (used.length === bindings.length) continue;
    edits.push({
      start: declaration.getFullStart(),
      end: declaration.getEnd(),
      text: used.length
        ? `\n${importLines(new Map([[declaration.getModuleSpecifierValue(), used]]), quote)[0]}`
        : '',
    });
  }
  const added = new Map<string, Binding[]>();
  for (const [statement, to] of moved)
    for (const name of declaredNames(statement)) {
      const node =
        Node.isClassDeclaration(statement) || Node.isFunctionDeclaration(statement)
          ? statement.getNameNode()
          : statement.getFirstDescendantByKind(SyntaxKind.Identifier);
      if (node && usedOutsideMoved(node))
        added.set(context.moduleSpecifier(to, path), [
          ...(added.get(context.moduleSpecifier(to, path)) ?? []),
          { kind: 'named', imported: name, local: name, typeOnly: false },
        ]);
    }
  if (added.size) {
    const last = file.getImportDeclarations().at(-1);
    const lines = importLines(added, quote).join('\n');
    edits.push(
      last
        ? { start: last.getEnd(), end: last.getEnd(), text: `\n${lines}` }
        : { start: 0, end: 0, text: `${lines}\n\n` },
    );
  }
  const source = kept.length ? tidy(applyEdits(context.text, edits)) : null;

  /** Files importing a moved item from this one. */
  const importers: { path: string; text: string }[] = [];
  for (const other of context.project.getSourceFiles()) {
    const otherPath = projectPath(other);
    if (other === file || otherPath.startsWith('node_modules/')) continue;
    const otherEdits: Edit[] = [];
    for (const declaration of other.getImportDeclarations()) {
      if (declaration.getModuleSpecifierSourceFile() !== file) continue;
      const bindings = bindingsOf(declaration);
      if (bindings.some((binding) => binding.kind !== 'named'))
        throw new CodeError(
          `${otherPath} imports ${path} as a whole: change it to import names, then try again.`,
        );
      const leaving = bindings.filter((binding) => targetOf.has(binding.imported!));
      if (!leaving.length) continue;
      const staying = bindings.filter((binding) => !targetOf.has(binding.imported!));
      const needs = new Map<string, Binding[]>();
      if (staying.length) needs.set(declaration.getModuleSpecifierValue(), staying);
      for (const binding of leaving) {
        const module = context.moduleSpecifier(targetOf.get(binding.imported!)!, otherPath);
        needs.set(module, [...(needs.get(module) ?? []), binding]);
      }
      const otherQuote = declaration.getModuleSpecifier().getText()[0] ?? quote;
      otherEdits.push({
        start: declaration.getStart(),
        end: declaration.getEnd(),
        text: importLines(needs, otherQuote).join('\n'),
      });
    }
    for (const declaration of other.getExportDeclarations())
      if (
        declaration.getModuleSpecifierSourceFile() === file &&
        declaration.getNamedExports().some((specifier) => targetOf.has(specifier.getName()))
      )
        throw new CodeError(
          `${otherPath} re-exports items of ${path}: move those exports by hand, then try again.`,
        );
    if (otherEdits.length)
      importers.push({ path: otherPath, text: applyEdits(other.getFullText(), otherEdits) });
  }
  return { files, source, importers };
};
