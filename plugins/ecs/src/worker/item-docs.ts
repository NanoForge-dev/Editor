import type { ClassDeclaration, Node } from 'ts-morph';

import {
  CodeError,
  type Doc,
  type TransformContext,
  leadingDocComments,
  parseDocComment,
} from '@nanoforge-dev/editor-sdk/worker';

import type { ItemDocsOp, ParamDocs } from '../model/item-docs.type';

/** Tags the Component panel manages on a param; the others are kept as written. */
const LAYOUT_TAGS = new Set(['group', 'preset', 'label', 'color', 'hidden']);

const lastDocRange = (node: Node) => leadingDocComments(node).at(-1);

const docOf = (node: Node): Doc => {
  const range = lastDocRange(node);
  return range ? parseDocComment(range.text) : { description: '', tags: [] };
};

/** A multi-line doc comment from its description and tags, at an indentation. */
const blockComment = (
  description: string,
  tags: readonly { name: string; text: string }[],
  indent: string,
) => {
  const lines: string[] = [];
  if (description) lines.push(...description.split('\n'));
  if (description && tags.length) lines.push('');
  for (const tag of tags) {
    const [first = '', ...rest] = tag.text.split('\n');
    lines.push(`@${tag.name}${first ? ` ${first}` : ''}`, ...rest);
  }
  return `/**\n${lines.map((line) => `${indent} *${line ? ` ${line}` : ''}`).join('\n')}\n${indent} */`;
};

/** A one-line doc comment when it fits, else a block. */
const paramComment = (
  description: string,
  tags: readonly { name: string; text: string }[],
  indent: string,
  ownLine: boolean,
) => {
  const inline = [
    description,
    ...tags.map((tag) => `@${tag.name}${tag.text ? ` ${tag.text}` : ''}`),
  ]
    .filter(Boolean)
    .join(' ');
  if (!inline) return '';
  if (inline.length <= 90 && !inline.includes('\n')) return `/** ${inline} */`;
  return ownLine
    ? blockComment(description, tags, indent)
    : `/** ${inline.replace(/\s+/g, ' ')} */`;
};

const layoutTags = (docs: ParamDocs): { name: string; text: string }[] => [
  ...(docs.group ? [{ name: 'group', text: docs.group }] : []),
  ...(docs.preset ? [{ name: 'preset', text: docs.preset }] : []),
  ...(docs.label ? [{ name: 'label', text: docs.label }] : []),
  ...(docs.color ? [{ name: 'color', text: docs.color }] : []),
  ...(docs.hidden ? [{ name: 'hidden', text: '' }] : []),
];

const groupText = (
  group: ItemDocsOp['groups'] extends readonly (infer G)[] | undefined ? G : never,
) =>
  [
    group.name,
    ...(group.color ? [`color=${group.color}`] : []),
    ...(group.hidden ? ['hidden'] : []),
    ...(group.description ? [`- ${group.description.replace(/\s+/g, ' ')}`] : []),
  ].join(' ');

/** Replaces (or inserts) the doc comment right before a node. */
const writeDoc = (context: TransformContext, node: Node, comment: string, ownLine: boolean) => {
  const range = lastDocRange(node);
  const indent = context.edit.indentationOf(node);
  if (range) {
    if (!comment) {
      context.edit.remove({ start: range.start, end: node.getStart() });
      return;
    }
    context.edit.replace({ start: range.start, end: range.end }, comment);
    return;
  }
  if (!comment) return;
  context.edit.insertAt(node.getStart(), ownLine ? `${comment}\n${indent}` : `${comment} `);
};

const isOnOwnLine = (context: TransformContext, node: Node) => {
  const lineStart = context.text.lastIndexOf('\n', node.getStart() - 1) + 1;
  return context.text.slice(lineStart, node.getStart()).trim() === '';
};

/**
 * Writes a component's docs from the Component panel: its description and `@group`
 * declarations (other tags kept), and each param's description and layout tags, as inline docs.
 */
export const transformItemDocs = (context: TransformContext, rawOp: unknown): void => {
  const op = rawOp as ItemDocsOp;
  const declaration = context.file.getClass(op.export);
  if (!declaration) throw new CodeError(`No class ${op.export} in this file.`);
  writeClassDocs(context, declaration, op);
  if (op.params) writeParamDocs(context, declaration, op.params);
};

const writeClassDocs = (
  context: TransformContext,
  declaration: ClassDeclaration,
  op: ItemDocsOp,
) => {
  if (op.description === undefined && op.groups === undefined) return;
  const doc = docOf(declaration);
  const description = op.description ?? doc.description;
  const kept = doc.tags.filter((tag) => op.groups === undefined || tag.name !== 'group');
  const groups = op.groups?.map((group) => ({ name: 'group', text: groupText(group) })) ?? [];
  const comment = blockComment(
    description,
    [...kept, ...groups],
    context.edit.indentationOf(declaration),
  );
  writeDoc(context, declaration, comment, true);
};

const writeParamDocs = (
  context: TransformContext,
  declaration: ClassDeclaration,
  params: Readonly<Record<string, ParamDocs>>,
) => {
  const constructor =
    declaration.getConstructors().find((candidate) => candidate.hasBody()) ??
    declaration.getConstructors()[0];
  const byName = new Map(
    constructor?.getParameters().map((param) => [param.getName(), param]) ?? [],
  );
  const fields = new Map(
    declaration.getProperties().map((property) => [property.getName(), property]),
  );
  for (const [name, docs] of Object.entries(params)) {
    const node: Node | undefined = byName.get(name) ?? fields.get(name);
    if (!node)
      throw new CodeError(`No param or field ${name} in ${declaration.getName() ?? 'this class'}.`);
    const doc = docOf(node);
    const others = doc.tags.filter((tag) => !LAYOUT_TAGS.has(tag.name));
    const description = docs.description ?? doc.description;
    const ownLine = isOnOwnLine(context, node);
    const comment = paramComment(
      description.replace(/\s+/g, ' ').trim(),
      [...layoutTags(docs), ...others],
      context.edit.indentationOf(node),
      ownLine,
    );
    writeDoc(context, node, comment, ownLine);
  }
  if (!constructor) return;
  const described = Object.entries(params)
    .filter(([name, docs]) => docs.description !== undefined && byName.has(name))
    .map(([name]) => name);
  const range = lastDocRange(constructor);
  if (!described.length || !range) return;
  const doc = parseDocComment(range.text);
  const tags = doc.tags.filter(
    (tag) =>
      tag.name !== 'param' ||
      !described.some((name) => new RegExp(`^(\\{[^}]*\\}\\s*)?\\[?${name}\\b`).test(tag.text)),
  );
  if (tags.length === doc.tags.length) return;
  const comment =
    doc.description || tags.length
      ? blockComment(doc.description, tags, context.edit.indentationOf(constructor))
      : '';
  writeDoc(context, constructor, comment, true);
};
