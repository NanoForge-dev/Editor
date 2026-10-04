import type { ContextKeyService } from '@nanoforge-dev/editor-kernel';

import { HISTORY_CONTEXT_KEY, TEXT_INPUT_FOCUS_KEY } from './history-context-keys.const';

export type UndoTarget =
  | { readonly kind: 'native' }
  | { readonly kind: 'context'; readonly id: string }
  | { readonly kind: 'none' };

/**
 * Where Ctrl+Z goes: native undo inside text inputs and the code editor, otherwise the history
 * context of the focused widget.
 */
export const resolveUndoTarget = (context: ContextKeyService, fallback?: string): UndoTarget => {
  if (context.get<boolean>(TEXT_INPUT_FOCUS_KEY)) return { kind: 'native' };
  const id = context.get<string>(HISTORY_CONTEXT_KEY) ?? fallback;
  return id ? { kind: 'context', id } : { kind: 'none' };
};
