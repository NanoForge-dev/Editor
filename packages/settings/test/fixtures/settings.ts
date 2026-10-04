import { z } from 'zod';
import { defineSetting } from '../../src';

export const fontSize = defineSetting({
  key: 'editor.fontSize',
  schema: z.number().int().min(6),
  default: 13,
});
export const theme = defineSetting({
  key: 'appearance.theme',
  schema: z.string(),
  default: 'dark',
  scopes: ['account', 'machine'],
});
export const colors = defineSetting({
  key: 'appearance.colors',
  schema: z.record(z.string(), z.string()),
  default: { background: '#000', text: '#fff' },
  mergeStrategy: 'deep',
});
export const disabled = defineSetting({
  key: 'plugins.disabled',
  schema: z.array(z.string()),
  default: [],
  mergeStrategy: 'union',
});
export const tabSize = defineSetting({
  key: 'code.tabSize',
  schema: z.number(),
  default: 2,
  renamedFrom: ['editor.tabSize'],
});
