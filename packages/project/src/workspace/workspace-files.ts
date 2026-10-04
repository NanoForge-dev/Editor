import type { AppModel } from '@nanoforge-dev/editor-protocol';

import { type Changes } from './changes';
import { CONFIG_NAMES } from './workspace.const';
import { WorkspaceError } from './workspace.exception';
import type { WorkspaceIo } from './workspace.type';

export type Json = Record<string, unknown>;

/** A JSON file rewritten with its own indentation. */
export const editJson = async (
  io: WorkspaceIo,
  changes: Changes,
  path: string,
  edit: (json: Json) => void,
): Promise<void> => {
  const text = io.exists(path) ? await io.read(path) : '{}\n';
  let json: Json;
  try {
    json = JSON.parse(text) as Json;
  } catch {
    throw new WorkspaceError(`${path} is not valid JSON`);
  }
  edit(json);
  const indent = /^(\s+)"/m.exec(text)?.[1]?.replace(/\n/g, '') ?? '  ';
  await changes.write(path, `${JSON.stringify(json, null, indent)}\n`);
};

/** The project path of `path` written relative to the folder `from` (both project paths). */
export const resolveFrom = (from: string, path: string): string => {
  const parts = from ? from.split('/') : [];
  for (const part of path.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
};

/** `to` written relative to the folder `from`, as a config's `libs` holds it. */
export const relativeTo = (from: string, to: string): string => {
  const source = from ? from.split('/') : [];
  const target = to.split('/');
  let common = 0;
  while (common < source.length && source[common] === target[common]) common++;
  return [...source.slice(common).map(() => '..'), ...target.slice(common)].join('/') || '.';
};

/** The `nanoforge.config.*` file of an app. */
export const configFile = (io: Pick<WorkspaceIo, 'exists'>, app: Pick<AppModel, 'root'>) =>
  CONFIG_NAMES.map((name) => (app.root ? `${app.root}/${name}` : name)).find((path) =>
    io.exists(path),
  );

export const packageJson = (app: Pick<AppModel, 'root'>): string =>
  app.root ? `${app.root}/package.json` : 'package.json';

/** Adds or removes a dependency on a library, keeping the keys sorted. */
export const setDependency = (json: Json, name: string, used: boolean): void => {
  const without = (entries: unknown) =>
    Object.entries((entries ?? {}) as Record<string, string>).filter(([key]) => key !== name);
  const dependencies = without(json.dependencies);
  if (used)
    dependencies.push([
      name,
      (json.dependencies as Record<string, string> | undefined)?.[name] ?? 'workspace:*',
    ]);
  else if (json.devDependencies)
    json.devDependencies = Object.fromEntries(without(json.devDependencies));
  const sorted = Object.fromEntries(dependencies.sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(sorted).length) json.dependencies = sorted;
  else delete json.dependencies;
};

/** `libs/*` (or `apps/*`) in the workspace's `packages`, when missing. */
export const withWorkspaceGlob = (text: string, glob: string): string => {
  if (text.includes(glob)) return text;
  return text.replace(/packages\s*:\s*\[([^\]]*)\]/, (_match, inner: string) => {
    const quote = inner.includes("'") ? "'" : '"';
    const items = inner.trim().replace(/,\s*$/, '');
    return `packages: [${items ? `${items}, ` : ''}${quote}${glob}${quote}]`;
  });
};
