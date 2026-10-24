/** New components and systems (templates with the TSDoc tags). */
import type { AppModel, ClientProject } from '@nanoforge-dev/editor-sdk';

export type ItemKind = 'component' | 'system';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export const kebab = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');

export const validateItemName = (kind: ItemKind, name: string): string | undefined => {
  if (!IDENTIFIER.test(name)) return 'Use letters, digits, _ or $, not starting with a digit.';
  if (kind === 'component' && !/^[A-Z]/.test(name))
    return 'Component names start with a capital letter.';
  if (kind === 'system' && !/^[a-z]/.test(name))
    return 'System names start with a lowercase letter.';
  return undefined;
};

/** `@side` of a new item: the app's side, `shared` in a shared library. */
export const sideOf = (target: AppModel): 'client' | 'server' | 'shared' =>
  target.type === 'lib' ? 'shared' : target.type;

export const itemTemplate = (kind: ItemKind, name: string, target: AppModel): string => {
  const side = sideOf(target);
  if (kind === 'component') {
    return [
      '/**',
      ` * ${name}: what it holds.`,
      ' *',
      ' * @component',
      ` * @side ${side}`,
      ' */',
      `export class ${name} {`,
      `  name = "${name}";`,
      '',
      '  constructor(',
      '    /** A value of the component. */',
      '    public value = 0,',
      '  ) {}',
      '}',
      '',
    ].join('\n');
  }
  const ecs = side === 'server' ? '@nanoforge-dev/ecs/server' : '@nanoforge-dev/ecs/client';
  return [
    'import type { Context } from "@nanoforge-dev/common";',
    `import type { Registry } from "${ecs}";`,
    '',
    '/**',
    ` * ${name}: what it does each tick.`,
    ' *',
    ' * @system',
    ` * @side ${side}`,
    ' */',
    `export function ${name}(registry: Registry, ctx: Context) {`,
    '  void registry;',
    '  void ctx;',
    '}',
    '',
  ].join('\n');
};

/** Path of a new item's file in an app or shared library. */
export const itemPath = (kind: ItemKind, name: string, target: AppModel): string =>
  `${kind === 'component' ? target.dirs.components : target.dirs.systems}/${kebab(name)}.ts`;

export const createItem = async (
  project: ClientProject,
  kind: ItemKind,
  name: string,
  target: AppModel,
): Promise<string> => {
  const path = itemPath(kind, name, target);
  if (project.fs.entry(path)) throw new Error(`${path} already exists.`);
  await project.fs.write(path, itemTemplate(kind, name, target), { expectedHash: null });
  return path;
};
