import type { Node, Statement } from 'ts-morph';

/** Text without the indentation its lines share. */
export const dedent = (text: string) => {
  const lines = text.split('\n');
  const indents = lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => line.match(/^\s*/)![0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return [lines[0]!, ...lines.slice(1).map((line) => line.slice(Math.min(cut, line.length)))].join(
    '\n',
  );
};

/** Applies edits from the end; at one same start, a removal goes before an insertion. */
export const applyEdits = (
  text: string,
  edits: readonly { start: number; end: number; text: string }[],
) => {
  let result = text;
  for (const edit of [...edits].sort(
    (a, b) => b.start - a.start || b.end - b.start - (a.end - a.start),
  ))
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  return result;
};

/** Where a statement ends, its same-line comment (`call(); // why`) included. */
export const trailingEnd = (node: Node) =>
  node.getTrailingCommentRanges().at(-1)?.getEnd() ?? node.getEnd();

/** Where a statement of a block starts: its leading trivia, without the previous one's comment. */
export const ownStart = (statements: readonly Statement[], statement: Statement) => {
  const previous = statements[statements.indexOf(statement) - 1];
  return previous
    ? Math.max(statement.getFullStart(), trailingEnd(previous))
    : statement.getFullStart();
};

/** A removed import's range: from its start, with the line break before it (no blank line left). */
export const removalStart = (text: string, start: number) => {
  const lineBreak = text.lastIndexOf('\n', start - 1);
  return lineBreak >= 0 && !text.slice(lineBreak + 1, start).trim() ? lineBreak : start;
};
