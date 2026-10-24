import {
  type InterfaceDeclaration,
  Node,
  type PropertySignature,
  type SourceFile,
  SyntaxKind,
} from 'ts-morph';

import {
  type AnalyzeContext,
  CodeError,
  type TransformContext,
} from '@nanoforge-dev/editor-sdk/worker';

import type {
  VarModel,
  VarUse,
  VarsAnalyzeArgs,
  VarsModel,
  VarsOp,
} from '../model/vars-model.type';
import { projectPath } from './scenes';

const METHODS = new Set(['init', 'set', 'get', 'has', 'remove']);
const MODULE = '@nanoforge-dev/scene';

/** `interface SceneVars` of a `declare module "@nanoforge-dev/scene"` block of a file. */
export const sceneVarsOf = (file: SourceFile): InterfaceDeclaration | undefined => {
  for (const module of file.getModules()) {
    const name = module.getName().replace(/^['"]|['"]$/g, '');
    if (name === MODULE) return module.getInterface('SceneVars');
  }
  return undefined;
};

const docOf = (property: PropertySignature) => {
  const doc = property.getJsDocs().at(-1);
  const description = doc?.getDescription().trim().replace(/\s+/g, ' ');
  const fallback = doc?.getTags().find((tag) => tag.getTagName() === 'default');
  return {
    ...(description && { description }),
    ...(fallback && { default: (fallback.getCommentText() ?? '').trim() }),
  };
};

const literalType = (node: Node | undefined): string | undefined => {
  if (!node) return undefined;
  if (Node.isNumericLiteral(node) || Node.isPrefixUnaryExpression(node)) return 'number';
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return 'string';
  if (node.getKind() === SyntaxKind.TrueKeyword || node.getKind() === SyntaxKind.FalseKeyword)
    return 'boolean';
  return undefined;
};

/**
 * The app's scene vars: their declaration in `SceneVars` (its file, its fields and docs) and
 * their uses (`….vars.init("key", …)` and the like, in the app's files).
 */
export const analyzeVars = (context: AnalyzeContext, rawArgs: unknown): VarsModel => {
  const { root } = rawArgs as VarsAnalyzeArgs;
  const prefix = root ? `${root}/` : '';
  let file: string | undefined;
  const vars: VarModel[] = [];
  const uses: VarUse[] = [];
  for (const source of context.project.getSourceFiles()) {
    const path = projectPath(source);
    if (!path.startsWith(prefix) || path.includes('/node_modules/') || path.endsWith('.d.ts'))
      continue;
    const declaration = sceneVarsOf(source);
    if (declaration && !file) {
      file = path;
      for (const property of declaration.getProperties())
        vars.push({
          name: property.getName(),
          type: property.getTypeNode()?.getText() ?? 'unknown',
          optional: property.hasQuestionToken(),
          ...docOf(property),
          line: property.getStartLineNumber(),
        });
    }
    for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression();
      if (!Node.isPropertyAccessExpression(callee) || !METHODS.has(callee.getName())) continue;
      const target = callee.getExpression();
      const isVars = Node.isPropertyAccessExpression(target)
        ? target.getName() === 'vars'
        : Node.isIdentifier(target) && target.getText() === 'vars';
      if (!isVars) continue;
      const [key, value] = call.getArguments();
      if (!key || !(Node.isStringLiteral(key) || Node.isNoSubstitutionTemplateLiteral(key)))
        continue;
      const className = call.getFirstAncestorByKind(SyntaxKind.ClassDeclaration)?.getName();
      const valueType = literalType(value);
      uses.push({
        key: key.getLiteralText(),
        kind: callee.getName() as VarUse['kind'],
        path,
        line: call.getStartLineNumber(),
        start: key.getStart() + 1,
        end: key.getEnd() - 1,
        ...(className && { className }),
        ...(valueType && { valueType }),
      });
    }
  }
  return { ...(file && { file }), vars, uses };
};

const fail = (message: string): never => {
  throw new CodeError(message);
};

/** The doc and line of a var's field. */
const fieldText = (
  indent: string,
  name: string,
  type: string,
  description: string | undefined,
  fallback: string | undefined,
) => {
  const doc = [description?.trim(), fallback?.trim() ? `@default ${fallback.trim()}` : '']
    .filter(Boolean)
    .join(' ');
  return `${doc ? `${indent}/** ${doc} */\n` : ''}${indent}${name}: ${type};`;
};

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Edits the `SceneVars` declaration of the file (see `VarsOp`). */
export const transformVars = (context: TransformContext, rawOp: unknown): void => {
  const op = rawOp as VarsOp;
  const declaration = sceneVarsOf(context.file) ?? fail('No `interface SceneVars` in this file.');
  const property = (name: string) =>
    declaration.getProperty(name) ?? fail(`No var "${name}" in SceneVars.`);
  const indentOf = (node: Node) => context.edit.indentationOf(node);

  switch (op.kind) {
    case 'addVar': {
      if (!IDENTIFIER.test(op.name)) fail(`"${op.name}" isn't a valid var name.`);
      if (declaration.getProperty(op.name)) fail(`The var "${op.name}" already exists.`);
      const last = declaration.getProperties().at(-1);
      const indent = last ? indentOf(last) : `${indentOf(declaration)}  `;
      const text = fieldText(indent, op.name, op.type, op.description, op.default);
      if (last) context.edit.insertAfter(last, `\n${text}`);
      else {
        const brace = declaration.getFirstChildByKindOrThrow(SyntaxKind.OpenBraceToken);
        context.edit.insertAfter(brace, `\n${text}`);
      }
      return;
    }
    case 'updateVar': {
      const field = property(op.name);
      const name = op.rename ?? op.name;
      if (op.rename && !IDENTIFIER.test(op.rename)) fail(`"${op.rename}" isn't a valid var name.`);
      if (op.rename && op.rename !== op.name && declaration.getProperty(op.rename))
        fail(`The var "${op.rename}" already exists.`);
      const current = docOf(field);
      const docs = field.getJsDocs();
      const start = docs[0]?.getStart() ?? field.getStart();
      const indent = indentOf(field);
      const text = fieldText(
        indent,
        `${name}${field.hasQuestionToken() ? '?' : ''}`,
        op.type ?? field.getTypeNode()?.getText() ?? 'unknown',
        op.description ?? current.description,
        op.default ?? current.default,
      );
      context.edit.replace({ start, end: field.getEnd() }, text.slice(indent.length));
      return;
    }
    case 'removeVar': {
      const field = property(op.name);
      const start = field.getJsDocs()[0]?.getStart() ?? field.getStart();
      context.edit.removeLines({ start, end: field.getEnd() });
      return;
    }
  }
};
