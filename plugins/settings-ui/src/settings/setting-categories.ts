import type { SettingDefinition, SettingScope } from '@nanoforge-dev/editor-sdk';

export const SCOPE_LABELS: Record<SettingScope, string> = {
  default: 'Default',
  account: 'Account',
  machine: 'This machine',
  project: 'Project',
  projectLocal: 'Project (only me)',
};

export const OTHER_CATEGORY = 'Other';

/** A node of the category tree: `Editor`, `Editor/Code editor`… */
export interface CategoryNode {
  readonly id: string;
  readonly label: string;
  readonly children: CategoryNode[];
}

export const categoryOf = (definition: SettingDefinition): string =>
  definition.category ?? OTHER_CATEGORY;

/** Category tree of every setting (paths split on `/`). */
export const categoryTree = (definitions: readonly SettingDefinition[]): CategoryNode[] => {
  const roots: CategoryNode[] = [];
  const index = new Map<string, CategoryNode>();
  for (const category of [...new Set(definitions.map(categoryOf))].sort()) {
    let parent: CategoryNode[] = roots;
    let path = '';
    for (const part of category.split('/')) {
      path = path ? `${path}/${part}` : part;
      let node = index.get(path);
      if (!node) {
        node = { id: path, label: part, children: [] };
        index.set(path, node);
        parent.push(node);
      }
      parent = node.children;
    }
  }
  return roots;
};

/** Settings of a category and its subcategories, ordered. */
export const settingsIn = (
  definitions: readonly SettingDefinition[],
  category: string,
): SettingDefinition[] =>
  definitions
    .filter((definition) => {
      const own = categoryOf(definition);
      return own === category || own.startsWith(`${category}/`);
    })
    .sort(
      (a, b) =>
        categoryOf(a).localeCompare(categoryOf(b)) ||
        (a.order ?? 0) - (b.order ?? 0) ||
        a.key.localeCompare(b.key),
    );

/** Settings whose title, description, key or tags contain every word of the query. */
export const searchSettings = (
  definitions: readonly SettingDefinition[],
  query: string,
): SettingDefinition[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return definitions.filter((definition) => {
    const text = [
      definition.title,
      definition.description,
      definition.key,
      categoryOf(definition),
      ...(definition.tags ?? []),
    ]
      .join(' ')
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
};
