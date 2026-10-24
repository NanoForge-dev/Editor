import { getContext, setContext } from 'svelte';

import type { Editor } from './create-editor';

const KEY = Symbol('nanoforge-editor');

/** Filled once the editor booted; the root layout renders pages only after that. */
export interface EditorRef {
  current: Editor | undefined;
}

export const provideEditor = (): EditorRef => setContext<EditorRef>(KEY, { current: undefined });

export const getEditor = (): Editor => {
  const editor = getContext<EditorRef | undefined>(KEY)?.current;
  if (!editor) throw new Error('The editor is not initialized');
  return editor;
};
