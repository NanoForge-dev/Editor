import type { Component } from 'svelte';

import { type ExtensionPoint, defineExtensionPoint } from '@nanoforge-dev/editor-kernel';

import type { WidgetInstance } from '../widget/widget-instance.type';
import type { MountedWidget } from './widget.extension-point';

/** The screens of the viewport. */
export type ViewportScreen = 'game' | 'scene';

/**
 * Content of the Scene screen for code generation targets: the scene editor of the ECS plugin
 * for its entry-file target, a scene plugin's own editor for its target…
 */
export interface SceneEditor {
  readonly id: string;
  readonly title: string;
  /** Ids of `code.codegenTargets` providers it edits (`*`: any). */
  readonly targets: readonly string[];
  /** Gets the Scene screen's widget instance, e.g. to point undo at the file it edits. */
  readonly component?: Component<{ instance?: WidgetInstance }>;
  readonly mount?: (element: HTMLElement) => MountedWidget;
}

export const SCENE_EDITORS: ExtensionPoint<SceneEditor> =
  defineExtensionPoint<SceneEditor>('ui.sceneEditors');

/** A button of the Game or Scene screen toolbar. */
export interface ViewportTool {
  readonly id: string;
  readonly screen: ViewportScreen;
  readonly icon: string;
  readonly title: string;
  readonly command: string;
  readonly order?: number;
  readonly when?: string;
  /** Pressed while this clause is true. */
  readonly toggled?: string;
}

export const VIEWPORT_TOOLS: ExtensionPoint<ViewportTool> =
  defineExtensionPoint<ViewportTool>('ui.viewportTools');

/** Drawn over the running game or the scene (e.g. gizmos, debug views). */
export interface ViewportOverlay {
  readonly id: string;
  readonly screen: ViewportScreen;
  readonly component: Component<Record<string, never>>;
}

export const VIEWPORT_OVERLAYS: ExtensionPoint<ViewportOverlay> =
  defineExtensionPoint<ViewportOverlay>('ui.viewportOverlays');
