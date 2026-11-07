import type { editor } from 'monaco-editor';

import type { Monaco } from './monaco';

/**
 * Disposes a diff editor, leaving the other editors working.
 *
 * Its models are detached first: a diff still being computed would otherwise make widgets
 * through its disposed services. Then a throwaway editor is made: every editor sets Monaco's
 * global hover delegate factory to its own services, and the diff editor's inner editors use a
 * child of them, disposed with it. Without that, the next hover or suggestion widget of any
 * editor throws "InstantiationService has been disposed".
 */
export const disposeDiffEditor = (monaco: Monaco, diff: editor.IStandaloneDiffEditor): void => {
  diff.setModel(null);
  diff.dispose();
  monaco.editor.create(window.document.createElement('div'), { model: null }).dispose();
};
