import { z } from 'zod';

import { MANIFEST_FILE } from '../item/item.schema';

/** How deep sub-manifests nest, the root manifest's own includes being the first level. */
export const MAX_INCLUDE_DEPTH = 4;
/** How many sub-manifests a package may have, in all. */
export const MAX_SUB_MANIFESTS = 100;

/** A core kind (`asset`, `type`…) or one owned by a plugin (`@nanoforge/ecs:component`). */
const KIND_PATTERN = /^(@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*:)?[a-z][a-z0-9-]*$/;

/** A path inside the package: no absolute path, no `..`, no `\`. */
export const isInsidePath = (path: string): boolean =>
  path.length > 0 &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  !/^[A-Za-z]:/.test(path) &&
  !path.split('/').some((segment) => segment === '..' || segment === '.');

const InsidePath = z.string().refine(isInsidePath, 'must be a path inside the package');

/**
 * One entry of a manifest's `contents`: a file, or a folder when its path ends with `/`. Extra
 * keys are owner objects (`"@scope/name": { … }`), kept as they are.
 */
export const ManifestContent = z
  .object({
    kind: z.string().regex(KIND_PATTERN, 'expected a kind like "asset" or "@scope/name:kind"'),
    path: InsidePath,
    export: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    side: z.enum(['client', 'server', 'shared']).optional(),
    tags: z.array(z.string()).optional(),
  })
  .loose();
export type ManifestContent = z.output<typeof ManifestContent>;

/** A content of a package, its path from the package root. */
export type PackageContent = ManifestContent & {
  /** The sub-manifest it is described in, from the package root; absent for the root manifest. */
  readonly manifest?: string;
};

export interface PackageContents {
  /** The contents of the root manifest, then of each sub-manifest, level by level. */
  readonly contents: PackageContent[];
  /** The sub-manifests read, from the package root. */
  readonly manifests: string[];
  /** What was skipped and why: the registry refuses these, a local package may still have them. */
  readonly problems: string[];
}

/** Reads the JSON of a file of the package, by its path from the package root; undefined if none. */
export type ManifestReader = (path: string) => Promise<unknown>;

interface Level {
  /** From the package root. */
  readonly file: string;
  /** Its folder, from the package root, `''` or ending with `/`. */
  readonly dir: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Every content a package describes: its manifest's `contents`, and those of the sub-manifests
 * `include` lists, as the registry reads them at publication. An `include` entry is a folder
 * (its `nanoforge.manifest.json`) or a `.json` file, relative to the manifest that lists it; a
 * sub-manifest only holds `contents` and `include`, and its paths are relative to its folder.
 *
 * Installed packages passed the registry's checks: what does not fit is skipped and reported in
 * `problems` rather than thrown, so a package being written still shows what it can.
 */
export const readPackageContents = async (
  manifest: unknown,
  read: ManifestReader,
): Promise<PackageContents> => {
  const result: PackageContents = { contents: [], manifests: [], problems: [] };
  if (!isObject(manifest)) return result;
  const seen = new Set([MANIFEST_FILE]);
  const root: Level = { file: MANIFEST_FILE, dir: '' };

  collect(manifest.contents, root, result);
  let level = includes(manifest.include, root, seen, result);
  for (let depth = 1; level.length; depth++) {
    if (depth > MAX_INCLUDE_DEPTH) {
      result.problems.push(`sub-manifests nest at most ${MAX_INCLUDE_DEPTH} levels deep`);
      break;
    }
    const next: Level[] = [];
    for (const sub of level) {
      if (result.manifests.length >= MAX_SUB_MANIFESTS) {
        result.problems.push(`at most ${MAX_SUB_MANIFESTS} sub-manifests`);
        return result;
      }
      const raw = await read(sub.file).catch(() => undefined);
      if (!isObject(raw)) {
        result.problems.push(`${sub.file}: missing, or not a JSON object`);
        continue;
      }
      result.manifests.push(sub.file);
      collect(raw.contents, sub, result);
      next.push(...includes(raw.include, sub, seen, result));
    }
    level = next;
  }
  return result;
};

const collect = (value: unknown, level: Level, result: PackageContents): void => {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    result.problems.push(`${level.file}: contents is not an array`);
    return;
  }
  value.forEach((entry, index) => {
    const parsed = ManifestContent.safeParse(entry);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      result.problems.push(
        `${level.file}: contents[${index}]${issue?.path.length ? `.${issue.path.join('.')}` : ''}: ${issue?.message ?? 'invalid'}`,
      );
      return;
    }
    result.contents.push({
      ...parsed.data,
      path: `${level.dir}${parsed.data.path}`,
      ...(level.file !== MANIFEST_FILE && { manifest: level.file }),
    });
  });
};

const includes = (
  value: unknown,
  parent: Level,
  seen: Set<string>,
  result: PackageContents,
): Level[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    result.problems.push(`${parent.file}: include is not an array`);
    return [];
  }
  const levels: Level[] = [];
  value.forEach((path: unknown, index) => {
    if (typeof path !== 'string' || !isInsidePath(path)) {
      result.problems.push(`${parent.file}: include[${index}] is not a path inside the package`);
      return;
    }
    const file = path.endsWith('.json')
      ? `${parent.dir}${path}`
      : `${parent.dir}${path.replace(/\/$/, '')}/${MANIFEST_FILE}`;
    if (seen.has(file)) {
      result.problems.push(`${parent.file}: include[${index}]: ${file} is included twice`);
      return;
    }
    seen.add(file);
    levels.push({ file, dir: file.slice(0, file.lastIndexOf('/') + 1) });
  });
  return levels;
};

/** How many contents of each kind there are. */
export const countKinds = (contents: readonly { kind: string }[]): Record<string, number> => {
  const kinds: Record<string, number> = {};
  for (const { kind } of contents) kinds[kind] = (kinds[kind] ?? 0) + 1;
  return kinds;
};
