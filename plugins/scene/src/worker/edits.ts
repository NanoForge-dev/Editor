import { type ClassDeclaration, Node, type SourceFile, SyntaxKind } from 'ts-morph';

import {
  type AnalyzeContext,
  CodeError,
  type TransformContext,
} from '@nanoforge-dev/editor-sdk/worker';

import type {
  LibraryOp,
  ReferenceRange,
  SceneFileOp,
  TextReplace,
} from '../model/scene-model.type';
import { findLibrary, projectPath } from './scenes';

const fail = (message: string): never => {
  throw new CodeError(message);
};

/** Adds `import { name } from <specifier of path>` unless the file already has the name. */
const ensureImport = (context: TransformContext, name: string, from: string): void => {
  const file = context.file;
  if (file.getClass(name)) return;
  const imported = file
    .getImportDeclarations()
    .some((declaration) =>
      declaration
        .getNamedImports()
        .some((specifier) => (specifier.getAliasNode()?.getText() ?? specifier.getName()) === name),
    );
  if (imported) return;
  const specifier = from.startsWith('@') ? from : context.moduleSpecifier(from);
  const existing = file
    .getImportDeclarations()
    .find(
      (declaration) =>
        declaration.getModuleSpecifierValue() === specifier && !declaration.isTypeOnly(),
    );
  const named = existing?.getNamedImports().at(-1);
  if (named) {
    context.edit.insertAfter(named, `, ${name}`);
    return;
  }
  const quote = context.literals.quoteStyle(context.file);
  const line = `import { ${name} } from ${quote}${specifier}${quote};\n`;
  const last = file.getImportDeclarations().at(-1);
  if (last) context.edit.insertAfter(last, `\n${line.trimEnd()}`);
  else context.edit.insertAt(0, `${line}\n`);
};

/** Removes the import of a name (the whole declaration when it is the only one). */
const removeImport = (context: TransformContext, name: string): void => {
  for (const declaration of context.file.getImportDeclarations()) {
    const named = declaration.getNamedImports();
    const specifier = named.find(
      (candidate) => (candidate.getAliasNode()?.getText() ?? candidate.getName()) === name,
    );
    if (!specifier) continue;
    if (named.length === 1 && !declaration.getDefaultImport())
      context.edit.removeLines(declaration);
    else {
      const index = named.indexOf(specifier);
      const next = named[index + 1];
      const previous = named[index - 1];
      if (next) context.edit.replace({ start: specifier.getStart(), end: next.getStart() }, '');
      else if (previous)
        context.edit.replace({ start: previous.getEnd(), end: specifier.getEnd() }, '');
    }
    return;
  }
};

/** Whether a name is still used in the file other than by its import and the given nodes. */
const usedElsewhere = (file: SourceFile, name: string, except: readonly Node[]): boolean =>
  file
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .some(
      (identifier) =>
        identifier.getText() === name &&
        !identifier.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) &&
        !except.some((node) => node === identifier || identifier.getAncestors().includes(node)),
    );

/** `new SceneLibrary({ … })` of the entry file: its `scenes` map and `initial` (see `LibraryOp`). */
export const transformLibrary = (context: TransformContext, rawOp: unknown): void => {
  const op = rawOp as LibraryOp;
  const library = findLibrary(context.file) ?? fail('No `new SceneLibrary(…)` in this file.');
  const options = library.options ?? fail('SceneLibrary has no options object to edit.');
  const scenes = options.getProperty('scenes');
  const map = scenes && Node.isPropertyAssignment(scenes) ? scenes.getInitializer() : undefined;

  switch (op.kind) {
    case 'addScene': {
      ensureImport(context, op.className, op.from);
      if (!map || !Node.isObjectLiteralExpression(map)) {
        const last = options.getProperties().at(-1);
        const text = `scenes: { ${op.className} }`;
        if (last) context.edit.insertAfter(last, `, ${text}`);
        else context.edit.replace(options, `{ ${text} }`);
        return;
      }
      const entries = map.getProperties();
      const last = entries.at(-1);
      if (last) context.edit.insertAfter(last, `, ${op.className}`);
      else context.edit.replace(map, `{ ${op.className} }`);
      return;
    }
    case 'removeScene': {
      const removed: Node[] = [];
      if (map && Node.isObjectLiteralExpression(map)) {
        const entries = map.getProperties();
        const index = entries.findIndex((entry) =>
          Node.isShorthandPropertyAssignment(entry)
            ? entry.getName() === op.className
            : Node.isPropertyAssignment(entry) &&
              entry.getInitializer()?.getText() === op.className,
        );
        const entry = entries[index];
        if (entry) {
          removed.push(entry);
          const next = entries[index + 1];
          const previous = entries[index - 1];
          if (next) context.edit.replace({ start: entry.getStart(), end: next.getStart() }, '');
          else if (previous)
            context.edit.replace({ start: previous.getEnd(), end: entry.getEnd() }, '');
          else context.edit.replace(map, '{}');
        }
      }
      const initial = options.getProperty('initial');
      if (initial && initial.getText().replace(/^initial:\s*/, '') === op.className)
        fail(`${op.className} is the initial scene: choose another initial scene first.`);
      if (!usedElsewhere(context.file, op.className, removed)) removeImport(context, op.className);
      return;
    }
    case 'setInitial': {
      ensureImport(context, op.className, op.from);
      const initial = options.getProperty('initial');
      if (initial && Node.isPropertyAssignment(initial)) {
        const value = initial.getInitializerOrThrow();
        context.edit.replace(value, op.className);
      } else if (initial && Node.isShorthandPropertyAssignment(initial)) {
        context.edit.replace(initial, `initial: ${op.className}`);
      } else {
        const first = options.getProperties()[0];
        if (first) context.edit.insertBefore(first, `initial: ${op.className}, `);
        else context.edit.replace(options, `{ initial: ${op.className} }`);
      }
      return;
    }
  }
};

const classOf = (context: TransformContext, name: string): ClassDeclaration =>
  context.file.getClass(name) ?? fail(`No class ${name} in this file.`);

/** A scene's own file: its `static parent`, or the class itself (see `SceneFileOp`). */
export const transformSceneFile = (context: TransformContext, rawOp: unknown): void => {
  const op = rawOp as SceneFileOp;
  switch (op.kind) {
    case 'setParent': {
      const declaration = classOf(context, op.className);
      const own = declaration.getStaticProperty('parent');
      const oldParent =
        own && Node.isPropertyDeclaration(own) ? own.getInitializer()?.getText() : undefined;
      const inherits = !!declaration.getBaseClass()?.getStaticProperty('parent');
      const value = op.parent?.className ?? (inherits ? 'undefined' : undefined);
      if (own) {
        if (value) context.edit.replace(own, `static override parent = ${value};`);
        else context.edit.removeLines(own);
      } else if (value) {
        const indent = `${context.edit.indentationOf(declaration)}  `;
        const brace = declaration.getFirstChildByKindOrThrow(SyntaxKind.OpenBraceToken);
        const members = declaration.getMembers();
        const text = `\n${indent}static override parent = ${value};${members.length ? '\n' : ''}`;
        context.edit.insertAfter(brace, text);
      }
      if (op.parent) ensureImport(context, op.parent.className, op.parent.from);
      if (oldParent && oldParent !== op.parent?.className && own) {
        if (!usedElsewhere(context.file, oldParent, [own])) removeImport(context, oldParent);
      }
      return;
    }
    case 'removeClass': {
      const declaration = classOf(context, op.className);
      const docs = declaration.getJsDocs();
      const start = docs[0]?.getStart() ?? declaration.getStart();
      context.edit.removeLines({ start, end: declaration.getEnd() });
      return;
    }
  }
};

/** Replaces ranges of the file with a text (a rename's references in this file). */
export const transformReplace = (context: TransformContext, rawOp: unknown): void => {
  const { ranges, text } = rawOp as TextReplace;
  for (const range of ranges) context.edit.replace(range, text);
};

/**
 * Every reference to a class of the analyzed file, in the whole project (its declaration's name
 * included), by file: what a rename changes.
 */
export const analyzeReferences = (context: AnalyzeContext, rawArgs: unknown): ReferenceRange[] => {
  const { className } = rawArgs as { className: string };
  const declaration = context.file.getClass(className) ?? fail(`No class ${className} here.`);
  const name = declaration.getNameNode() ?? fail(`${className} has no name.`);
  const byPath = new Map<string, { start: number; end: number }[]>();
  for (const node of name.findReferencesAsNodes()) {
    const path = projectPath(node.getSourceFile());
    if (path.includes('/node_modules/')) continue;
    const ranges = byPath.get(path) ?? [];
    ranges.push({ start: node.getStart(), end: node.getEnd() });
    byPath.set(path, ranges);
  }
  const own = byPath.get(context.path) ?? [];
  if (!own.some((range) => range.start === name.getStart()))
    byPath.set(context.path, [...own, { start: name.getStart(), end: name.getEnd() }]);
  return [...byPath].map(([path, ranges]) => ({ path, ranges }));
};

/** Exported classes of the analyzed file (to know whether a scene is alone in it). */
export const analyzeClasses = (context: AnalyzeContext): string[] =>
  context.file
    .getClasses()
    .map((declaration) => declaration.getName())
    .filter((name): name is string => !!name);
