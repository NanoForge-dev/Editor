/** Replacement of `[start, end)` (UTF-16 offsets) by `text`: a serializable document operation. */
export interface TextEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Applies non-overlapping edits (any order) and returns the new text with the inverse edits. */
export const applyTextEdits = (
  source: string,
  edits: readonly TextEdit[],
): { text: string; inverse: TextEdit[] } => {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.start < sorted[i - 1]!.end) throw new Error('Overlapping text edits');
  }
  let text = '';
  let cursor = 0;
  let delta = 0;
  const inverse: TextEdit[] = [];
  for (const edit of sorted) {
    if (edit.start < cursor || edit.end > source.length || edit.start > edit.end) {
      throw new Error(`Text edit out of range: ${edit.start}-${edit.end}`);
    }
    text += source.slice(cursor, edit.start) + edit.text;
    const start = edit.start + delta;
    inverse.push({
      start,
      end: start + edit.text.length,
      text: source.slice(edit.start, edit.end),
    });
    delta += edit.text.length - (edit.end - edit.start);
    cursor = edit.end;
  }
  return { text: text + source.slice(cursor), inverse };
};
