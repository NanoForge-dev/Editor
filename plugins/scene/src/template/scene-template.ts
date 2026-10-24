/** A new scene's file (an `EcsScene` with the TSDoc tags), and its path. */
import type { AppModel } from '@nanoforge-dev/editor-sdk';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export const kebab = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');

/** An error message for a scene class name, or `undefined` when it is fine. */
export const validateSceneName = (name: string, taken: readonly string[]): string | undefined => {
  if (!IDENTIFIER.test(name)) return 'Use letters, digits, _ or $, not starting with a digit.';
  if (!/^[A-Z]/.test(name)) return 'Scene names start with a capital letter.';
  if (taken.includes(name)) return `${name} already exists.`;
  return undefined;
};

/** Where a new scene's file goes: the app's scenes folder. */
export const scenePath = (app: AppModel, name: string): string =>
  `${app.dirs.scenes}/${kebab(name)}.ts`;

/** The import of a file from another one in the same app (relative, no extension). */
export const relativeImport = (from: string, to: string): string => {
  const source = from.split('/').slice(0, -1);
  const target = to.replace(/\.[cm]?[jt]sx?$/, '').split('/');
  let common = 0;
  while (common < source.length && source[common] === target[common]) common++;
  const up = source.length - common;
  const rest = target.slice(common).join('/');
  return up ? `${'../'.repeat(up)}${rest}` : `./${rest}`;
};

export const sceneTemplate = (
  app: AppModel,
  name: string,
  parent?: { className: string; path: string },
): string => {
  const side = app.type === 'server' ? 'server' : 'client';
  const path = scenePath(app, name);
  return [
    'import type { Context } from "@nanoforge-dev/common";',
    `import type { Registry } from "@nanoforge-dev/ecs/${side}";`,
    'import { EcsScene } from "@nanoforge-dev/ecs/scene";',
    ...(parent
      ? ['', `import { ${parent.className} } from "${relativeImport(path, parent.path)}";`]
      : []),
    '',
    '/**',
    ` * ${name}: what it shows.`,
    ' *',
    ' * @scene',
    ` * @side ${side}`,
    ' */',
    `export class ${name} extends EcsScene {`,
    ...(parent ? [`  static override parent = ${parent.className};`, ''] : []),
    '  override setup(registry: Registry, ctx: Context) {}',
    '}',
    '',
  ].join('\n');
};
