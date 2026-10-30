/** A replacement of `start`…`end` of a text. */
export interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Applies edits from the end of the text. */
export const applyEdits = (text: string, edits: readonly Edit[]) => {
  let result = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start))
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  return result;
};

/** A removed import's range: from its start, with the line break before it (no blank line left). */
export const removalStart = (text: string, start: number) => {
  const lineBreak = text.lastIndexOf('\n', start - 1);
  return lineBreak >= 0 && !text.slice(lineBreak + 1, start).trim() ? lineBreak : start;
};

/** At most one blank line in a row, and one line break at the end. */
export const tidy = (text: string) => `${text.replace(/\n{3,}/g, '\n\n').trim()}\n`;
