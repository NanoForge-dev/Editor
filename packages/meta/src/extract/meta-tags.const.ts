/** Tags the core reads itself (ADR 0003). */
export const CORE_TAGS: ReadonlySet<string> = new Set([
  'remarks',
  'param',
  'example',
  'side',
  'asset',
  'deprecated',
  'internal',
  'group',
  'preset',
  'label',
  'color',
  'hidden',
]);

/** Common JSDoc/TSDoc tags that are neither core nor owner tags: never reported. */
export const STANDARD_TAGS: ReadonlySet<string> = new Set([
  'returns',
  'return',
  'see',
  'throws',
  'since',
  'template',
  'typeParam',
  'link',
  'inheritDoc',
  'default',
  'defaultValue',
  'privateRemarks',
  'beta',
  'alpha',
  'experimental',
  'public',
  'override',
  'virtual',
  'sealed',
  'readonly',
  'author',
  'todo',
  'type',
  'module',
  'packageDocumentation',
]);

export const SIDES: ReadonlySet<string> = new Set(['client', 'server', 'shared']);
