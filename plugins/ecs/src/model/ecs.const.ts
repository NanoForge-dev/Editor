export const ECS_KEY = '@nanoforge/ecs';

export const ENTRY_ANALYZER = 'ecs.entry-file';
export const ITEM_DOCS_TRANSFORMER = 'ecs.item-docs';
export const IMPORTERS_ANALYZER = 'ecs.importers';
export const RELOCATED_TEXT_ANALYZER = 'ecs.relocated-text';
export const REWRITE_IMPORTS_TRANSFORMER = 'ecs.rewrite-imports';
export const BUNDLE_SPAWNS_ANALYZER = 'ecs.bundle-spawns';
export const ENTRY_TRANSFORMER = 'ecs.entry-file';
/** Items an entry file declares itself (adoption). */
export const LOCAL_ITEMS_ANALYZER = 'ecs.local-items';
/** Moves items of a file to files of their own (adoption). */
export const SPLIT_ITEMS_ANALYZER = 'ecs.split-items';
/** A file's imports of another, pointed elsewhere, as text (adoption). */
export const REDIRECTED_IMPORTS_ANALYZER = 'ecs.redirected-imports';
