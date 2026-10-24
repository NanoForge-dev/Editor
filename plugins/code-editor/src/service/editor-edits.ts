import type { editor as MonacoEditor } from 'monaco-editor';

import type { CodeDiagnostic } from '@nanoforge-dev/editor-sdk';

import type { Monaco } from '../monaco/monaco';

/** The smallest edit turning `before` into `after` (keeps cursors and folding elsewhere). */
export const minimalEdit = (before: string, after: string) => {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end++;
  return { start, end: before.length - end, text: after.slice(start, after.length - end) };
};

export const toMarker = (
  monaco: Monaco,
  model: MonacoEditor.ITextModel,
  diagnostic: CodeDiagnostic,
): MonacoEditor.IMarkerData => {
  const offset =
    diagnostic.start >= 0
      ? diagnostic.start
      : model.getOffsetAt({ lineNumber: diagnostic.line ?? 1, column: diagnostic.column ?? 1 });
  const start = model.getPositionAt(offset);
  const end = model.getPositionAt(offset + Math.max(diagnostic.length, 1));
  return {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
    message: diagnostic.message,
    source: diagnostic.source,
    ...(diagnostic.code !== undefined && { code: String(diagnostic.code) }),
    severity:
      diagnostic.severity === 'error'
        ? monaco.MarkerSeverity.Error
        : diagnostic.severity === 'warning'
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
  };
};
