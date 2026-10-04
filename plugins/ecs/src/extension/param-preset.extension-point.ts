import type { Component } from 'svelte';

import { defineExtensionPoint } from '@nanoforge-dev/editor-sdk';

import type { PresetDefinition, PresetRow } from '../layout/param-layout';
import type { ArgValue } from '../model/ecs-model.type';

export interface PresetEditorProps {
  readonly row: PresetRow;
  /** The value of each slot (same order as `row.slots`). */
  readonly values: readonly unknown[];
  readonly disabled: boolean;
  /** New values by param index. */
  onchange(args: Record<number, ArgValue>): void;
}

/** A visual preset merging params (see "Param layout"), with its own control if it has one. */
export interface ParamPreset extends PresetDefinition {
  readonly component?: Component<PresetEditorProps>;
}

export const PARAM_PRESETS = defineExtensionPoint<ParamPreset>('ecs.paramPresets');
