/** Groups of console sources, in display order. */
export const GROUPS = [
  { id: 'game', label: 'Game', shown: true },
  { id: 'build', label: 'Build', shown: true },
  { id: 'tasks', label: 'Tasks', shown: true },
  { id: 'editor', label: 'Editor', shown: false },
  { id: 'plugins', label: 'Plugins', shown: false },
] as const;

export type GroupId = (typeof GROUPS)[number]['id'];

/**
 * The group of a logger name: `game:client`, `build:<app>` and `cli:<command>` come from the
 * runtime, plugins log under their name (`@scope/name`), the rest is the editor itself.
 */
export const groupOf = (source: string): GroupId => {
  if (source.startsWith('game:')) return 'game';
  if (source.startsWith('build:')) return 'build';
  if (source.startsWith('cli:')) return 'tasks';
  if (source.startsWith('@')) return 'plugins';
  return 'editor';
};

/** A source as shown on a line: without the prefix its group already tells. */
export const sourceLabel = (source: string): string => {
  const label = source.replace(/^(game|build|cli):/, '');
  return label || 'project';
};
