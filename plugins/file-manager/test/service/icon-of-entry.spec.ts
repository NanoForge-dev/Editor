import { describe, expect, it } from 'vitest';

import { iconOfEntry } from '../../src/service/icon-of-entry';

const icons = [
  { pattern: '**/*.ts', icon: 'file-code' },
  { pattern: '**/*.ts', icon: 'ts-logo', priority: 1000 },
  { pattern: '**/assets', icon: 'folder-images', iconOpen: 'folder-images-open', folder: true },
];

describe('iconOfEntry', () => {
  it('takes the highest priority icon of a file, else a file', () => {
    expect(iconOfEntry(icons, { path: 'src/main.ts', kind: 'file' })).toBe('ts-logo');
    expect(iconOfEntry(icons, { path: 'README.md', kind: 'file' })).toBe('file');
  });

  it('gives folders their own icons, open while expanded, else the folder icons', () => {
    expect(iconOfEntry(icons, { path: 'apps/client/assets', kind: 'directory' })).toBe(
      'folder-images',
    );
    expect(iconOfEntry(icons, { path: 'apps/client/assets', kind: 'directory' }, true)).toBe(
      'folder-images-open',
    );
    expect(iconOfEntry(icons, { path: 'src', kind: 'directory' }, true)).toBe('folder-open');
    expect(iconOfEntry(icons, { path: 'assets.ts', kind: 'directory' })).toBe('folder');
  });
});
