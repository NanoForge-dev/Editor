import type { AppModel } from './project.schema';

/**
 * The app or shared library a project path belongs to: the deepest one whose root holds it (a
 * single-app project's root is `''`, which holds every path).
 */
export const appAt = <T extends Pick<AppModel, 'root'>>(
  apps: readonly T[],
  path: string,
): T | undefined =>
  apps
    .filter((app) => app.root === '' || path === app.root || path.startsWith(`${app.root}/`))
    .sort((a, b) => b.root.length - a.root.length)[0];
