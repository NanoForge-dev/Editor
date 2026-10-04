export interface FuzzyMatch {
  /** Higher is better. */
  readonly score: number;
  /** Matched character ranges of the text, `[start, end)`, for highlighting. */
  readonly ranges: readonly (readonly [number, number])[];
}

const isBoundary = (text: string, index: number): boolean => {
  if (index === 0) return true;
  const previous = text[index - 1]!;
  const current = text[index]!;
  return (
    /[\s/\\._:›>-]/.test(previous) ||
    (previous === previous.toLowerCase() && current !== current.toLowerCase())
  );
};

/**
 * Matches the letters of a query in order in a text, not necessarily adjacent (spaces of the
 * query are ignored). Letters at the start of words and runs of adjacent letters score higher,
 * a query found in one piece higher still, and so do matches near the start and shorter texts.
 * Undefined when a letter is missing.
 */
export const fuzzyMatch = (query: string, text: string): FuzzyMatch | undefined => {
  const needle = query.replace(/\s+/g, '').toLowerCase();
  if (!needle) return { score: 0, ranges: [] };
  const haystack = text.toLowerCase();
  if (needle.length > haystack.length) return undefined;

  const NONE = -Infinity;
  let previous: number[] = [];
  const back: number[][] = [];
  for (let i = 0; i < needle.length; i++) {
    const current = new Array<number>(haystack.length).fill(NONE);
    const from = new Array<number>(haystack.length).fill(-1);
    let bestBefore = NONE;
    let bestBeforeAt = -1;
    for (let j = i; j < haystack.length; j++) {
      if (i > 0 && j > 0 && previous[j - 1]! > bestBefore) {
        bestBefore = previous[j - 1]!;
        bestBeforeAt = j - 1;
      }
      if (haystack[j] !== needle[i]) continue;
      let score = 1;
      if (isBoundary(text, j)) score += 8;
      if (i === 0) {
        current[j] = score - Math.min(j, 10) * 0.2;
        continue;
      }
      const adjacent = j > 0 ? previous[j - 1]! : NONE;
      const run = adjacent === NONE ? NONE : adjacent + score + 5;
      const jump = bestBefore === NONE ? NONE : bestBefore + score;
      if (run >= jump && run !== NONE) {
        current[j] = run;
        from[j] = j - 1;
      } else if (jump !== NONE) {
        current[j] = jump;
        from[j] = bestBeforeAt;
      }
    }
    back.push(from);
    previous = current;
  }

  let end = -1;
  for (let j = 0; j < previous.length; j++) {
    if (previous[j]! > (end < 0 ? NONE : previous[end]!)) end = j;
  }
  if (end < 0) return undefined;

  const positions: number[] = [];
  for (let i = needle.length - 1, j = end; i >= 0; i--) {
    positions.unshift(j);
    j = back[i]![j]!;
  }
  const ranges: [number, number][] = [];
  for (const position of positions) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === position) last[1] = position + 1;
    else ranges.push([position, position + 1]);
  }
  const whole = ranges.length === 1 ? 10 : 0;
  return { score: previous[end]! + whole - text.length * 0.01, ranges };
};

/** Splits a text into plain and matched parts, for rendering highlights. */
export const highlight = (
  text: string,
  ranges: readonly (readonly [number, number])[],
): { text: string; match: boolean }[] => {
  const parts: { text: string; match: boolean }[] = [];
  let last = 0;
  for (const [start, end] of ranges) {
    if (start > last) parts.push({ text: text.slice(last, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    last = end;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts;
};
