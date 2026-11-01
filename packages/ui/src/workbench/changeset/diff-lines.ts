/** A line of a diff: kept (`' '`), removed (`'-'`) or added (`'+'`), with its line numbers. */
export interface DiffLine {
  readonly kind: ' ' | '-' | '+';
  readonly text: string;
  /** In the old text (kept and removed lines). */
  readonly old?: number;
  /** In the new text (kept and added lines). */
  readonly new?: number;
}

/** A run of changed lines with some unchanged ones around them. */
export interface DiffHunk {
  readonly lines: readonly DiffLine[];
}

/** Past this many line pairs, a file is shown as all removed then all added. */
const MAX_CELLS = 4_000_000;

const split = (text: string | undefined) =>
  text === undefined || text === '' ? [] : text.replace(/\n$/, '').split('\n');

/** The lines of two texts, kept, removed and added (a longest common subsequence). */
export const diffLines = (before: string | undefined, after: string | undefined): DiffLine[] => {
  const a = split(before);
  const b = split(after);
  const lines: DiffLine[] = [];
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  for (let i = 0; i < start; i++) lines.push({ kind: ' ', text: a[i]!, old: i + 1, new: i + 1 });
  const n = endA - start;
  const m = endB - start;
  if (n * m > MAX_CELLS) {
    for (let i = start; i < endA; i++) lines.push({ kind: '-', text: a[i]!, old: i + 1 });
    for (let j = start; j < endB; j++) lines.push({ kind: '+', text: b[j]!, new: j + 1 });
  } else {
    /** `lcs[i][j]`: length of the common subsequence of a[start+i…] and b[start+j…]. */
    const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        lcs[i]![j] =
          a[start + i] === b[start + j]
            ? lcs[i + 1]![j + 1]! + 1
            : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        lines.push({ kind: ' ', text: a[start + i]!, old: start + i + 1, new: start + j + 1 });
        i++;
        j++;
      } else if (i < n && (j === m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
        lines.push({ kind: '-', text: a[start + i]!, old: start + i + 1 });
        i++;
      } else {
        lines.push({ kind: '+', text: b[start + j]!, new: start + j + 1 });
        j++;
      }
    }
  }
  for (let i = endA, j = endB; i < a.length; i++, j++)
    lines.push({ kind: ' ', text: a[i]!, old: i + 1, new: j + 1 });
  return lines;
};

/** The changed lines in hunks, with `context` unchanged lines around each. */
export const diffHunks = (lines: readonly DiffLine[], context = 3): DiffHunk[] => {
  const keep = lines.map(() => false);
  lines.forEach((line, index) => {
    if (line.kind === ' ') return;
    for (
      let k = Math.max(0, index - context);
      k <= Math.min(lines.length - 1, index + context);
      k++
    )
      keep[k] = true;
  });
  const hunks: DiffHunk[] = [];
  let current: DiffLine[] | undefined;
  lines.forEach((line, index) => {
    if (!keep[index]) {
      current = undefined;
      return;
    }
    if (!current) hunks.push({ lines: (current = []) });
    current.push(line);
  });
  return hunks;
};
