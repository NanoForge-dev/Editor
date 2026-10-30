import { describe, expect, it } from 'vitest';

import { createUnsavedStore } from '../../src/document/unsaved-store';

describe('createUnsavedStore', () => {
  it('keeps unsaved texts per project in memory without IndexedDB', async () => {
    const one = createUnsavedStore('one');
    const other = createUnsavedStore('other');
    const text = { text: 'draft', baseHash: 'h1', time: 1 };
    await one.set('src/main.ts', text);
    expect(await one.get('src/main.ts')).toEqual(text);
    expect(await other.get('src/main.ts')).toBeUndefined();
    await one.delete('src/main.ts');
    expect(await one.get('src/main.ts')).toBeUndefined();
  });
});
