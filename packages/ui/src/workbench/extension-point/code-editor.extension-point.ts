import type { Component } from 'svelte';

import {
  type ExtensionPoint,
  type Observable,
  defineExtensionPoint,
} from '@nanoforge-dev/editor-kernel';

/**
 * A panel beside the code editor, for some files (e.g. the ECS plugin's Component panel next to a
 * component's source). The code editor shows the panels that apply to the active file, with a
 * toggle in its toolbar.
 */
export interface CodeEditorSidePanel {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
  /** Fires when `appliesTo` may give another answer (the catalog changed…). */
  readonly changes?: Observable<unknown>;
  readonly component: Component<{ path: string }>;
  /** Whether the panel applies to a file (project path). */
  appliesTo(path: string): boolean;
}

export const CODE_EDITOR_SIDE_PANELS: ExtensionPoint<CodeEditorSidePanel> =
  defineExtensionPoint<CodeEditorSidePanel>('codeEditor.sidePanels');

/**
 * Context key holding the project path of the file in the focused code editor group; unset when
 * no file is open (or the code editor never opened one).
 */
export const CODE_EDITOR_ACTIVE_FILE = 'codeEditor.activeFile';
