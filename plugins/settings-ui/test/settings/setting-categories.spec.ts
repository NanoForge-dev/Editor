import { describe, expect, it } from 'vitest';

import type { SettingDefinition } from '@nanoforge-dev/editor-sdk';

import { categoryTree, searchSettings, settingsIn } from '../../src/settings/setting-categories';

const setting = (key: string, extra: Partial<SettingDefinition> = {}) =>
  ({ key, title: key, description: '', tags: [], ...extra }) as SettingDefinition;

const SETTINGS = [
  setting('editor.fontSize', { category: 'Editor', title: 'Font size', order: 2 }),
  setting('editor.tabSize', { category: 'Editor', title: 'Tab size', order: 1 }),
  setting('code.format', {
    category: 'Editor/Code editor',
    title: 'Format on save',
    tags: ['prettier'],
  }),
  setting('misc.thing'),
];

describe('setting categories', () => {
  it('builds the category tree from slash paths, sorted, with Other for the rest', () => {
    expect(categoryTree(SETTINGS)).toEqual([
      {
        id: 'Editor',
        label: 'Editor',
        children: [{ id: 'Editor/Code editor', label: 'Code editor', children: [] }],
      },
      { id: 'Other', label: 'Other', children: [] },
    ]);
  });

  it('lists a category with its subcategories, by category then order', () => {
    expect(settingsIn(SETTINGS, 'Editor').map((definition) => definition.key)).toEqual([
      'editor.tabSize',
      'editor.fontSize',
      'code.format',
    ]);
    expect(settingsIn(SETTINGS, 'Other').map((definition) => definition.key)).toEqual([
      'misc.thing',
    ]);
  });

  it('finds settings holding every word of the query, tags and category included', () => {
    expect(searchSettings(SETTINGS, 'PRETTIER save').map((definition) => definition.key)).toEqual([
      'code.format',
    ]);
    expect(searchSettings(SETTINGS, 'editor size')).toHaveLength(2);
    expect(searchSettings(SETTINGS, '  ')).toEqual([]);
  });
});
