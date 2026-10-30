import { describe, expect, it } from 'vitest';

import { declarationOffset, layoutWarnings } from '../../src/layout/layout-diagnostics';

const component = (name: string, preset?: string, readonly = false) =>
  ({
    ref: name,
    readonly,
    meta: {
      export: name,
      source: `apps/client/src/components/${name}.ts`,
      params: [
        {
          type: 'number',
          name: 'x',
          ...(preset && { layout: { preset: { id: preset, slot: 'x' } } }),
        },
      ],
      fields: [],
      groups: [],
      '@nanoforge/ecs': { type: 'component', name },
    },
  }) as never;

describe('layout diagnostics', () => {
  it('finds the name in the declaration of an export', () => {
    const text = 'import x from "y";\n\n/** Doc. */\nexport class Position {\n}\n';
    const at = declarationOffset(text, 'Position')!;
    expect(text.slice(at.start, at.start + at.length)).toBe('Position');
    expect(declarationOffset(text, 'Missing')).toBeUndefined();
  });

  it('reports the warnings of components the project can edit', () => {
    const warnings = layoutWarnings(
      [component('Broken', 'vector'), component('Fine'), component('Package', 'vector', true)],
      [],
    );
    expect(warnings.map((entry) => [entry.item.meta.export, entry.warnings])).toEqual([
      ['Broken', ['The preset "vector" needs the slots x, y.']],
    ]);
  });
});
