import { type Node, ts } from 'ts-morph';

import type { Doc } from './doc.type';

const EMPTY: Doc = { description: '', tags: [] };
const TAG = /(^|\s)@([A-Za-z][\w-]*)/g;
const FENCE = /^\s*```/;

/**
 * Parses a `/** … *\/` comment. Tags are read anywhere after whitespace, also on one line
 * (`/** Distance. @group Coords @preset vector.x *\/`), except inside ``` fences and `{@link}`.
 */
export const parseDocComment = (raw: string): Doc => {
  const body = raw
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''))
    .join('\n');

  const marks: { start: number; end: number; name: string }[] = [];
  let offset = 0;
  let fenced = false;
  for (const line of body.split('\n')) {
    if (FENCE.test(line)) fenced = !fenced;
    else if (!fenced) {
      for (const match of line.matchAll(TAG)) {
        const start = offset + match.index + match[1]!.length;
        marks.push({ start, end: start + 1 + match[2]!.length, name: match[2]! });
      }
    }
    offset += line.length + 1;
  }

  const description = body.slice(0, marks[0]?.start ?? body.length).trim();
  const tags = marks.map((mark, index) => ({
    name: mark.name,
    text: body.slice(mark.end, marks[index + 1]?.start ?? body.length).trim(),
  }));
  return { description, tags };
};

/**
 * `/** … *\/` comments right before a node, as `{ start, end, text }`. Read from the node's full
 * start with the compiler API: ts-morph gives the first parameter's comment (`(/** … *\/ x`) to
 * the parameter list instead.
 */
export const leadingDocComments = (
  node: Node,
): { readonly start: number; readonly end: number; readonly text: string }[] => {
  const text = node.getSourceFile().getFullText();
  const ranges = [
    ...(ts.getTrailingCommentRanges(text, node.getPos()) ?? []),
    ...(ts.getLeadingCommentRanges(text, node.getPos()) ?? []),
  ].filter((range, index, all) => all.findIndex((other) => other.pos === range.pos) === index);
  return ranges
    .sort((a, b) => a.pos - b.pos)
    .map((range) => ({ start: range.pos, end: range.end, text: text.slice(range.pos, range.end) }))
    .filter((range) => range.text.startsWith('/**'));
};

/** The last `/** … *\/` comment right before a node, parsed. */
export const docOf = (node: Node | undefined): Doc => {
  if (!node) return EMPTY;
  const last = leadingDocComments(node).at(-1);
  return last ? parseDocComment(last.text) : EMPTY;
};

export const tagTexts = (doc: Doc, name: string): string[] =>
  doc.tags.filter((tag) => tag.name === name).map((tag) => tag.text);

export const firstTag = (doc: Doc, name: string): string | undefined => tagTexts(doc, name)[0];

export const hasTag = (doc: Doc, name: string): boolean =>
  doc.tags.some((tag) => tag.name === name);

/** `@param name - text` (or `@param name text`) of a doc. */
export const paramTexts = (doc: Doc): Map<string, string> => {
  const result = new Map<string, string>();
  for (const text of tagTexts(doc, 'param')) {
    const match = /^\{[^}]*\}\s*/.exec(text);
    const rest = match ? text.slice(match[0].length) : text;
    const [, name, description] = /^\[?([\w$.]+)\]?\s*(?:-\s*)?([\s\S]*)$/.exec(rest) ?? [];
    if (name) result.set(name, (description ?? '').replace(/\s+/g, ' ').trim());
  }
  return result;
};

/** The text of an `@example`, without its ``` fence. */
export const exampleText = (text: string): string =>
  text
    .replace(/^\s*```\w*\s*\n?/, '')
    .replace(/\n?\s*```\s*$/, '')
    .trim();

/** Collapses the line breaks of a description written over several lines. */
export const oneParagraph = (text: string): string =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
