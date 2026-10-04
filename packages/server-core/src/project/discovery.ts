import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import type { AppModel, ProjectModel } from '@nanoforge-dev/editor-protocol';
import { joinPath } from '@nanoforge-dev/editor-protocol';

import { expandDirectoryGlobs } from '../util/glob';
import {
  CONFIG_FILES,
  ConfigLoadError,
  type ConfigLoader,
  type ResolvedConfig,
} from './config-loader';

/** `@nanoforge-dev/*` packages that are tooling, not engine libraries. */
const TOOLING_PACKAGES = new Set([
  '@nanoforge-dev/actions',
  '@nanoforge-dev/cli',
  '@nanoforge-dev/config',
  '@nanoforge-dev/schematics',
  '@nanoforge-dev/utils-eslint-config',
  '@nanoforge-dev/utils-prettier-config',
]);

type Diagnostic = ProjectModel['diagnostics'][number];

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface DiscoveryInput {
  readonly id: string;
  readonly root: string;
  readonly location: string;
  readonly loader: ConfigLoader;
}

const toPosix = (path: string) => path.split(sep).join('/');

export const findConfigFile = (directory: string): string | undefined =>
  CONFIG_FILES.map((file) => join(directory, file)).find((file) => existsSync(file));

const readJson = async <T>(file: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
};

/** Installed version of a package, looked up from `from` up to the project root. */
const installedVersion = async (
  name: string,
  from: string,
  root: string,
): Promise<string | undefined> => {
  for (let dir = from; ; dir = dirname(dir)) {
    const pkg = await readJson<{ version?: string }>(
      join(dir, 'node_modules', name, 'package.json'),
    );
    if (pkg?.version) return pkg.version;
    if (dir === root || dirname(dir) === dir) return undefined;
  }
};

const engineLibs = async (
  appRoot: string,
  projectRoot: string,
  pkg: PackageJson | undefined,
): Promise<Record<string, string>> => {
  const declared: Record<string, string> = { ...pkg?.devDependencies, ...pkg?.dependencies };
  const names = new Set(
    Object.keys(declared).filter(
      (name) => name.startsWith('@nanoforge-dev/') && !TOOLING_PACKAGES.has(name),
    ),
  );
  const libs: Record<string, string> = {};
  for (const name of [...names].sort()) {
    libs[name] = (await installedVersion(name, appRoot, projectRoot)) ?? declared[name] ?? '*';
  }
  return libs;
};

/** Every package an app's package.json depends on (narrowed to the project's libraries later). */
const declaredPackages = (pkg: PackageJson | undefined): string[] =>
  Object.keys({ ...pkg?.devDependencies, ...pkg?.dependencies });

/** What an app says about the shared libraries it uses, before the project's are all known. */
export interface LibraryUses {
  /** The app's config file, for diagnostics. */
  readonly configFile: string;
  /** Its config's `libs` (clients and servers): the written path and the folder it points at. */
  readonly libs?: readonly { readonly path: string; readonly root: string }[];
  /** Every package its package.json depends on. */
  readonly packages: readonly string[];
}

/**
 * Fills each app's `libraries`: the shared libraries its `nanoforge.config` lists in `libs`
 * (paths relative to the app, as the CLI writes them). A library depends on others through its
 * package.json (a lib config has no `libs`). The package.json of a client or server should depend
 * on the same libraries: where it does not, or where `libs` names a folder that is no library,
 * a warning says so. A library nothing mentions (a project made before apps chose their
 * libraries) is given to every app, so nothing disappears.
 */
export const resolveLibraries = (
  apps: AppModel[],
  uses: ReadonlyMap<string, LibraryUses>,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  const libraries = apps.filter((app) => app.type === 'lib');
  const mentioned = new Set<string>();
  for (const app of apps) {
    const use = uses.get(app.id);
    const packages = use?.packages ?? [];
    const declared = libraries.filter(
      (library) => library !== app && packages.includes(library.name),
    );
    if (app.type === 'lib' || !use?.libs) {
      app.libraries = declared.map((library) => library.name);
      for (const library of declared) mentioned.add(library.name);
      continue;
    }
    const listed: AppModel[] = [];
    for (const { path, root } of use.libs) {
      const library = libraries.find((candidate) => candidate.root === root);
      if (library) listed.push(library);
      else
        diagnostics.push({
          path: use.configFile,
          message: `libs lists "${path}", which is not a shared library of the project.`,
          severity: 'warning',
        });
    }
    for (const library of [...listed, ...declared]) mentioned.add(library.name);
    for (const library of listed.filter((candidate) => !declared.includes(candidate)))
      diagnostics.push({
        path: use.configFile,
        message: `${app.name} uses ${library.name} (libs), but its package.json does not depend on it: add "${library.name}": "workspace:*".`,
        severity: 'warning',
      });
    for (const library of declared.filter((candidate) => !listed.includes(candidate)))
      diagnostics.push({
        path: use.configFile,
        message: `${app.name}'s package.json depends on ${library.name}, but its libs does not list ${library.root}: the editor does not give it to the app.`,
        severity: 'warning',
      });
    app.libraries = listed.map((library) => library.name);
  }
  const unclaimed = libraries.filter((library) => !mentioned.has(library.name));
  for (const library of unclaimed) library.unclaimed = true;
  for (const app of apps) {
    app.libraries = [
      ...new Set([
        ...app.libraries,
        ...unclaimed.filter((library) => library !== app).map((library) => library.name),
      ]),
    ].sort();
  }
  return diagnostics;
};

const toApp = async (
  projectRoot: string,
  appRoot: string,
  config: ResolvedConfig,
  uses: Map<string, LibraryUses>,
): Promise<AppModel | undefined> => {
  if (config.type === 'workspace') return undefined;
  const root = toPosix(relative(projectRoot, appRoot));
  const pkg = await readJson<PackageJson>(join(appRoot, 'package.json'));
  const name = pkg?.name ?? (basename(appRoot) || 'app');
  const at = (path: string) => joinPath(root, path);
  const configFile = toPosix(relative(projectRoot, findConfigFile(appRoot) ?? appRoot));
  uses.set(root, {
    configFile,
    packages: declaredPackages(pkg),
    ...(config.type !== 'lib' && {
      libs: config.libs.map((path) => ({
        path,
        root: toPosix(relative(projectRoot, resolve(appRoot, path))),
      })),
    }),
  });

  if (config.type === 'lib') {
    return {
      id: root,
      name,
      type: 'lib',
      root,
      language: 'ts',
      dirs: {
        assets: at(config.dir.assets),
        components: at(config.dir.components),
        systems: at(config.dir.systems),
        scenes: at(config.dir.scenes),
      },
      engineLibs: await engineLibs(appRoot, projectRoot, pkg),
      libraries: [],
    };
  }
  return {
    id: root,
    name,
    type: config.type,
    root,
    language: config.language,
    dirs: {
      assets: at(config.dir.assets),
      components: at(config.dir.components),
      systems: at(config.dir.systems),
      scenes: at(config.dir.scenes),
    },
    entryFile: at(config.entryFile),
    editorEntryFile: at(config.editor.entryFile),
    outDir: at(config.out.dir),
    engineLibs: await engineLibs(appRoot, projectRoot, pkg),
    libraries: [],
  };
};

/**
 * Builds the project model from `nanoforge.config.*` files: a workspace lists its apps
 * through `packages` globs; a project whose root config is an app is a single-app project.
 * Problems become diagnostics instead of failing the whole discovery.
 */
export const discoverProject = async (input: DiscoveryInput): Promise<ProjectModel> => {
  const { root, loader } = input;
  const diagnostics: Diagnostic[] = [];
  const apps: AppModel[] = [];
  const uses = new Map<string, LibraryUses>();
  const rootPkg = await readJson<PackageJson>(join(root, 'package.json'));
  const model = (): ProjectModel => ({
    id: input.id,
    name: rootPkg?.name ?? basename(root),
    location: input.location,
    apps: apps.sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics,
  });

  const load = async (directory: string): Promise<ResolvedConfig | undefined> => {
    const file = findConfigFile(directory);
    const path = toPosix(relative(root, file ?? join(directory, CONFIG_FILES[0]!)));
    if (!file) {
      const legacy = existsSync(join(directory, 'nanoforge.config.json'));
      diagnostics.push({
        path: legacy ? toPosix(relative(root, join(directory, 'nanoforge.config.json'))) : path,
        message: legacy
          ? 'This project was made by an older NanoForge CLI (nanoforge.config.json). The editor needs a project made by the CLI version 2 or later (nanoforge.config.ts): update the CLI and create the project again.'
          : 'No nanoforge.config file found',
        severity: 'error',
      });
      return undefined;
    }
    try {
      return await loader.load(file);
    } catch (error) {
      const message =
        error instanceof ConfigLoadError || error instanceof Error ? error.message : String(error);
      diagnostics.push({ path, message, severity: 'error' });
      return undefined;
    }
  };

  const rootConfig = await load(root);
  if (!rootConfig) return model();
  if (rootConfig.type !== 'workspace') {
    const app = await toApp(root, root, rootConfig, uses);
    if (app) apps.push(app);
    return model();
  }

  for (const directory of await expandDirectoryGlobs(root, rootConfig.packages)) {
    const appRoot = join(root, directory);
    if (!findConfigFile(appRoot)) continue; // plain folders matched by a glob
    const config = await load(appRoot);
    if (!config) continue;
    if (config.type === 'workspace') {
      diagnostics.push({
        path: joinPath(directory, 'nanoforge.config.ts'),
        message: 'Nested workspaces are not supported',
        severity: 'warning',
      });
      continue;
    }
    const app = await toApp(root, appRoot, config, uses);
    if (app) apps.push(app);
  }
  diagnostics.push(...resolveLibraries(apps, uses));
  if (!apps.length) {
    diagnostics.push({ path: '', message: 'The workspace has no apps', severity: 'warning' });
  }
  return model();
};
