import { Node, type Statement } from 'ts-morph';

import { CodeError, type TransformContext } from '@nanoforge-dev/editor-sdk/worker';

import type { ArgValue } from '../model/ecs-model.type';
import type { ParsedEntity, ParsedEntry } from './entry-file';

export const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
export const CODE_EXTENSION = /\.[cm]?[jt]sx?$/;

export const fail = (message: string): never => {
  throw new CodeError(message);
};

export const entityOf = (parsed: ParsedEntry, name: string): ParsedEntity =>
  parsed.entities.find((entity) => entity.name === name) ??
  fail(`The entity "${name}" isn't declared as \`const ${name} = registry.spawnEntity();\`.`);

export const lastStatementOf = (entity: ParsedEntity): Statement =>
  entity.components.at(-1) ?? entity.declaration;

/** Names already used in the file (declarations and references). */
export const usedNames = (context: TransformContext): Set<string> =>
  new Set(
    context.file
      .getDescendants()
      .filter(Node.isIdentifier)
      .map((node) => node.getText()),
  );

export const uniqueName = (context: TransformContext, base: string): string => {
  const used = usedNames(context);
  const clean = IDENTIFIER.test(base) ? base : 'entity';
  if (!used.has(clean)) return clean;
  for (let index = 2; ; index++) if (!used.has(`${clean}${index}`)) return `${clean}${index}`;
};

export const checkNewName = (context: TransformContext, name: string) => {
  if (!IDENTIFIER.test(name)) fail(`"${name}" isn't a valid name: use letters, digits, _ or $.`);
  if (usedNames(context).has(name)) fail(`"${name}" is already used in this file.`);
};

export const literal = (context: TransformContext, value: ArgValue, indent: string): string =>
  'code' in value
    ? value.code
    : context.literals.valueToLiteral(value.value as never, {
        quote: context.literals.quoteStyle(context.file),
        indent,
      });

/** Writes the first statement of an empty block (`setup() {}` of a new scene). */
export const insertInEmpty = (context: TransformContext, block: Node, text: string): void => {
  const indent = context.edit.indentationOf(block.getParentOrThrow());
  const step = indent.includes('\t') ? '\t' : '  ';
  const open = block.getStart() + 1;
  const close = block.getEnd() - 1;
  context.edit.replace({ start: open, end: close }, `\n${indent}${step}${text}\n${indent}`);
};

/** Inserts a statement on its own line after another one. */
export const insertAfter = (context: TransformContext, anchor: Node, text: string) =>
  context.edit.insertAfter(anchor, `\n${context.edit.indentationOf(anchor)}${text}`);

/** Start of the line of a node, and end of the line of another (with its line break). */
export const lineRange = (context: TransformContext, first: Node, last: Node) => {
  const start = context.text.lastIndexOf('\n', first.getStart() - 1) + 1;
  const newline = context.text.indexOf('\n', last.getEnd());
  return { start, end: newline < 0 ? context.text.length : newline + 1 };
};

/** Moves whole lines [first..last] to the start of the line of `target`. */
export const moveLines = (
  context: TransformContext,
  first: Node,
  last: Node,
  target: Node | number,
) => {
  const block = lineRange(context, first, last);
  const at =
    typeof target === 'number' ? target : context.text.lastIndexOf('\n', target.getStart() - 1) + 1;
  if (at > block.start && at < block.end) return;
  context.edit.remove(block);
  context.edit.insertAt(at, context.text.slice(block.start, block.end));
};
