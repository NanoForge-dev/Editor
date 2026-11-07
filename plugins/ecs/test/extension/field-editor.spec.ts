import type { Component } from 'svelte';
import { describe, expect, it } from 'vitest';

import { type FieldEditor, fieldEditorFor } from '../../src/extension/field-editor.extension-point';
import { buildLayout } from '../../src/layout/param-layout';

const component = {} as Component<never>;

describe('contributed field editors and presets', () => {
  it('prefers an editor for the ref, then one for the type', () => {
    const rect: FieldEditor = { ref: '@nanoforge-dev/graphics-2d#Rect', component };
    const anyRef: FieldEditor = { type: 'ref', component };
    const numbers: FieldEditor = { type: 'number', component };
    const editors = [anyRef, rect, numbers];
    expect(
      fieldEditorFor(editors, {
        type: 'ref',
        name: 'shape',
        ref: '@nanoforge-dev/graphics-2d#Rect',
      }),
    ).toBe(rect);
    expect(fieldEditorFor(editors, { type: 'ref', name: 'shape', ref: '@x/y#Circle' })).toBe(
      anyRef,
    );
    expect(fieldEditorFor(editors, { type: 'number', name: 'x' })).toBe(numbers);
    expect(fieldEditorFor(editors, { type: 'string', name: 's' })).toBeUndefined();
  });

  it('merges params with a contributed preset', () => {
    const layout = buildLayout(
      [
        { type: 'number', name: 'min', layout: { preset: { id: 'range', slot: 'min' } } },
        { type: 'number', name: 'max', layout: { preset: { id: 'range', slot: 'max' } } },
      ],
      [],
      new Set(),
      [
        {
          id: 'range',
          title: 'Range',
          slots: ['min', 'max'],
          required: ['min', 'max'],
          types: ['number'],
        },
      ],
    );
    expect(layout.warnings).toEqual([]);
    expect(layout.blocks).toMatchObject([
      { kind: 'preset', label: 'Range', slots: [{ slot: 'min' }, { slot: 'max' }] },
    ]);
  });
});
