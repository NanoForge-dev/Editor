import type { CommandPreview } from '@nanoforge-dev/editor-history';

const PREVIEW_CONTEXT = 1;
const PREVIEW_MAX_LINES = 12;

/** The changed lines of a document (and one line around), before and after. */
export const previewOf = (uri: string, before: string, after: string): CommandPreview => {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end++;
  const lines = (text: string, from: number, to: number) => {
    const all = text.split('\n');
    const first = Math.max(0, text.slice(0, from).split('\n').length - 1 - PREVIEW_CONTEXT);
    const last = Math.min(all.length, text.slice(0, to).split('\n').length + PREVIEW_CONTEXT);
    return all.slice(first, Math.min(last, first + PREVIEW_MAX_LINES)).join('\n');
  };
  return {
    title: uri,
    before: lines(before, start, before.length - end),
    after: lines(after, start, after.length - end),
  };
};
