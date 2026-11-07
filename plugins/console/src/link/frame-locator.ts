import { type FileTarget, type TextSegment, linkify } from './linkify';

export interface Frame {
  readonly file: string;
  readonly line: number;
  readonly column?: number;
}

/** Links of a line's texts, computed once per line. */
export const createSegmenter = (exists: (path: string) => boolean) => {
  const cache = new WeakMap<object, Map<string, TextSegment[]>>();
  return (line: object, text: string): TextSegment[] => {
    let texts = cache.get(line);
    if (!texts) cache.set(line, (texts = new Map()));
    let segments = texts.get(text);
    if (!segments) texts.set(text, (segments = linkify(text, exists)));
    return segments;
  };
};

/**
 * Project files behind positions in built bundles, looked up once per position (a stack frame
 * shows on every render of its line).
 */
export class FrameLocator {
  private _found = new Map<string, Promise<FileTarget | undefined>>();

  constructor(
    private readonly _resolve: (
      frame: Frame,
    ) => Promise<{ path: string; line: number; column: number } | undefined> | undefined,
    private readonly _limit = 2000,
  ) {}

  locate = (frame: Frame): Promise<FileTarget | undefined> => {
    const key = `${frame.file}:${frame.line}:${frame.column ?? 1}`;
    let result = this._found.get(key);
    if (!result) {
      if (this._found.size >= this._limit) this._found.clear();
      result = Promise.resolve(this._resolve(frame))
        .then((found) => (found ? ({ kind: 'file', ...found } as const) : undefined))
        .catch(() => undefined);
      this._found.set(key, result);
    }
    return result;
  };

  clear(): void {
    this._found.clear();
  }
}
