import type { Node } from 'ts-morph';

import { CodeError } from './code.exception';
import type { TextEdit } from './engine.type';

type Target = Node | { readonly start: number; readonly end: number };

const range = (target: Target) =>
  'getStart' in target ? { start: target.getStart(), end: target.getEnd() } : target;

/**
 * Collects edits as replacements of node ranges. Code outside the edited ranges is never
 * touched, so formatting and comments elsewhere are preserved by construction.
 */
export class EditBuilder {
  private readonly _edits: TextEdit[] = [];

  constructor(private readonly _text: string) {}

  replace(target: Target, text: string): this {
    const { start, end } = range(target);
    return this._push({ start, end, text });
  }

  insertBefore(target: Target, text: string): this {
    const { start } = range(target);
    return this._push({ start, end: start, text });
  }

  insertAfter(target: Target, text: string): this {
    const { end } = range(target);
    return this._push({ start: end, end, text });
  }

  insertAt(offset: number, text: string): this {
    return this._push({ start: offset, end: offset, text });
  }

  remove(target: Target): this {
    const { start, end } = range(target);
    return this._push({ start, end, text: '' });
  }

  /** Removes whole lines covered by the node (with its indentation and line break). */
  removeLines(target: Target): this {
    const { start, end } = range(target);
    const lineStart = this._text.lastIndexOf('\n', start - 1) + 1;
    const newline = this._text.indexOf('\n', end);
    const lineEnd = newline < 0 ? this._text.length : newline + 1;
    const before = this._text.slice(lineStart, start);
    const after = this._text.slice(end, newline < 0 ? this._text.length : newline);
    return before.trim() === '' && after.trim().replace(/^;/, '') === ''
      ? this._push({ start: lineStart, end: lineEnd, text: '' })
      : this._push({ start, end, text: '' });
  }

  /** Indentation of the line where the node starts. */
  indentationOf(target: Target): string {
    const { start } = range(target);
    const lineStart = this._text.lastIndexOf('\n', start - 1) + 1;
    return /^[ \t]*/.exec(this._text.slice(lineStart, start))![0];
  }

  /** Edits sorted by position; overlapping edits are a programming error. */
  build(): TextEdit[] {
    const sorted = [...this._edits].sort((a, b) => a.start - b.start || a.end - b.end);
    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1]!;
      if (sorted[i]!.start < previous.end) {
        throw new CodeError(
          `Overlapping edits at ${previous.start}-${previous.end} and ${sorted[i]!.start}`,
        );
      }
    }
    return sorted;
  }

  private _push(edit: TextEdit): this {
    if (edit.start < 0 || edit.end > this._text.length || edit.start > edit.end) {
      throw new CodeError(`Edit out of range: ${edit.start}-${edit.end}`);
    }
    if (edit.text !== this._text.slice(edit.start, edit.end)) this._edits.push(edit);
    return this;
  }
}
