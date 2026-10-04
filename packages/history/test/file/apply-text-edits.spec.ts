import { describe, expect, it } from 'vitest';

import { applyTextEdits } from '../../src';

describe('applyTextEdits', () => {
  it('applies unordered edits and returns their inverse', () => {
    const source = 'const a = 1;\nconst b = 2;\n';
    const { text, inverse } = applyTextEdits(source, [
      { start: 23, end: 24, text: '20' },
      { start: 10, end: 11, text: '10' },
    ]);
    expect(text).toBe('const a = 10;\nconst b = 20;\n');
    expect(applyTextEdits(text, inverse).text).toBe(source);
    expect(() =>
      applyTextEdits(source, [
        { start: 0, end: 5, text: '' },
        { start: 3, end: 6, text: '' },
      ]),
    ).toThrow(/Overlapping/);
  });
});
