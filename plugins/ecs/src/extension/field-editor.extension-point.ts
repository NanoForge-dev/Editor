import type { Component } from 'svelte';

import { type Element, type ElementType, defineExtensionPoint } from '@nanoforge-dev/editor-sdk';

import type { ArgModel, ArgValue, ImportNeed } from '../model/ecs-model.type';

/**
 * Extension points of the ECS plugin. Other plugins contribute with the same ids (and declare
 * `@nanoforge/ecs` as a dependency): `defineExtensionPoint('ecs.fieldEditors')`.
 */

export interface FieldEditorProps {
  readonly element: Element;
  readonly arg: ArgModel | undefined;
  readonly label: string;
  readonly disabled: boolean;
  onchange(value: ArgValue, imports?: ImportNeed[]): void;
}

/** The inspector field of an element type, or of one `ref` (`@nanoforge-dev/graphics-2d#Rect`). */
export interface FieldEditor {
  readonly type?: ElementType;
  readonly ref?: string;
  readonly component: Component<FieldEditorProps>;
}

export const FIELD_EDITORS = defineExtensionPoint<FieldEditor>('ecs.fieldEditors');

/** The contributed editor for an element: one for its ref first, else one for its type. */
export const fieldEditorFor = (
  editors: readonly FieldEditor[],
  element: Element,
): FieldEditor | undefined =>
  (element.type === 'ref' ? editors.find((editor) => editor.ref === element.ref) : undefined) ??
  editors.find((editor) => !editor.ref && editor.type === element.type);
