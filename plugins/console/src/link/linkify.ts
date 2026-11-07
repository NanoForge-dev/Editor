/** A position in a project file. */
export interface FileTarget {
  readonly kind: 'file';
  readonly path: string;
  readonly line?: number;
  readonly column?: number;
}

/** A position in a file outside of the project's sources: maybe a built game bundle. */
export interface FrameTarget {
  readonly kind: 'frame';
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

export interface TextSegment {
  readonly text: string;
  readonly target?: FileTarget | FrameTarget;
}

/**
 * Either a URL with a position (a stack frame of a client bundle), or something that looks like
 * a file with an extension, then an optional position: `:12`, `:12:3` or TypeScript's `(12,3)`.
 */
const TOKEN =
  /((?:https?|file):\/\/[^\s()]+?):(\d+):(\d+)(?=[\s)]|$)|((?:[A-Za-z]:)?[\w@.~\-/\\]*[\w-]\.[A-Za-z]\w*)(?::(\d+)(?::(\d+))?|\((\d+),(\d+)\))?/g;

/** The project file a path names: itself, or its longest tail that is a project file. */
const projectFile = (path: string, exists: (path: string) => boolean): string | undefined => {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized.startsWith('/') && !/^[A-Za-z]:/.test(normalized))
    return exists(normalized) ? normalized : undefined;
  const segments = normalized.split('/');
  for (let index = 1; index < segments.length; index++) {
    const tail = segments.slice(index).join('/');
    if (exists(tail)) return tail;
  }
  return undefined;
};

/**
 * Splits a console line into text and links: paths of project files (with their position), and
 * positions in other files, which may be built bundles to map back to sources.
 */
export const linkify = (text: string, exists: (path: string) => boolean): TextSegment[] => {
  const segments: TextSegment[] = [];
  let last = 0;
  const push = (match: RegExpExecArray, target: FileTarget | FrameTarget) => {
    if (match.index > last) segments.push({ text: text.slice(last, match.index) });
    segments.push({ text: match[0], target });
    last = match.index + match[0].length;
  };
  for (const match of text.matchAll(TOKEN) as Iterable<RegExpExecArray>) {
    if (match[1]) {
      push(match, {
        kind: 'frame',
        file: match[1],
        line: Number(match[2]),
        column: Number(match[3]),
      });
      continue;
    }
    const line = match[5] ?? match[7];
    const column = match[6] ?? match[8];
    const path = projectFile(match[4]!, exists);
    if (path) {
      push(match, {
        kind: 'file',
        path,
        ...(line && { line: Number(line) }),
        ...(column && { column: Number(column) }),
      });
    } else if (line && /^(\/|[A-Za-z]:)/.test(match[4]!)) {
      push(match, {
        kind: 'frame',
        file: match[4]!,
        line: Number(line),
        column: Number(column ?? 1),
      });
    }
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
};
