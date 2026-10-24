/**
 * Core transformer pointing the imports of a package (`@pong/shared`, `@pong/shared/x`) at a
 * new name; op `{ from, to }`. Kept apart from the engine: the main thread needs the id too.
 */
export const RENAME_PACKAGE_TRANSFORMER = 'core.renamePackage';
