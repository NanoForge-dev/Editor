import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { Disposable } from '@nanoforge-dev/editor-kernel';
import { type InstalledPackage, RegistryContract } from '@nanoforge-dev/editor-protocol';
import { RpcError, type RpcRouter } from '@nanoforge-dev/editor-rpc';
import {
  DirectoryRegistry,
  type OutdatedPackage,
  ProjectPackages,
  type Registry,
  RegistryClient,
  RegistryError,
  installItem,
  pickVersion,
} from '@nanoforge-dev/registry';

import { PROJECT_PLUGINS_DIR } from '../../plugin/plugin-sources';
import type { RequestContext } from '../../session/auth';
import type { CoreRpcDependencies } from '../core-rpc.type';

/** Implements the registry contract. */
export const implementRegistryRpc = (
  router: RpcRouter<RequestContext>,
  deps: CoreRpcDependencies,
): Disposable => {
  const { env, projects } = deps;
  const noRegistry = (): never => {
    throw new RegistryError('UNAVAILABLE', 'The registry is not available yet');
  };
  const registry: Registry = env.registryDir
    ? new DirectoryRegistry(env.registryDir)
    : env.registryUrl
      ? new RegistryClient({ baseUrl: env.registryUrl })
      : { search: noRegistry, get: noRegistry, download: noRegistry };
  const editorEngine = { editor: deps.version };
  /** Runs registry code, turning its failures into RPC errors with the same message. */
  const withRegistry = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof RegistryError)) throw error;
      const code = (
        {
          NOT_FOUND: 'NOT_FOUND',
          UNAVAILABLE: 'UNAVAILABLE',
          INVALID: 'BAD_REQUEST',
          INTEGRITY: 'PRECONDITION_FAILED',
          CONFLICT: 'CONFLICT',
          IN_USE: 'CONFLICT',
        } as const
      )[error.code];
      throw new RpcError(code, error.message);
    }
  };
  const localOnly = () => {
    if (env.mode !== 'OFFLINE') throw new RpcError('FORBIDDEN', 'Installing is for local editors');
  };
  const pluginFolder = (
    session: RequestContext['session'],
    target: { name: string; scope: 'user' | 'project'; project?: string | undefined },
  ) => {
    localOnly();
    if (target.scope === 'user') return join(deps.plugins.installedDir, ...target.name.split('/'));
    if (!target.project) throw new RpcError('BAD_REQUEST', 'A project is needed for this scope');
    return join(
      projects.get(session, target.project).root,
      PROJECT_PLUGINS_DIR,
      ...target.name.split('/'),
    );
  };
  const packagesOf = (session: RequestContext['session'], project: string) => {
    localOnly();
    return new ProjectPackages(projects.get(session, project).root, registry);
  };
  /** The project's packages; without the registry, without what is newer. */
  const listPackages = async (packages: ProjectPackages): Promise<InstalledPackage[]> => {
    const listed: readonly OutdatedPackage[] = await packages
      .outdated()
      .catch(async (error: unknown) => {
        if (error instanceof RegistryError && error.code === 'UNAVAILABLE') return packages.list();
        throw error;
      });
    return listed.map((entry) => ({ ...entry, dependents: [...entry.dependents] }));
  };
  return router.implement(RegistryContract, {
    methods: {
      search: ({ type, q, page }) => withRegistry(() => registry.search({ type, q, page })),
      details: ({ name }) =>
        withRegistry(async () => {
          const item = await registry.get(name);
          const compatible =
            item.type === 'plugin' ? pickVersion(item, '*', editorEngine)?.version : item.version;
          return { ...item, ...(compatible && { compatible }) };
        }),
      installPlugin: (input, { session }) =>
        withRegistry(async () => {
          const target = pluginFolder(session, input);
          const item = await registry.get(input.name);
          if (item.type !== 'plugin')
            throw new RegistryError('INVALID', `${input.name} is a package, not a plugin`);
          const version = input.version
            ? item.versions.find((entry) => entry.version === input.version)
            : pickVersion(item, '*', editorEngine);
          if (!version) {
            throw new RegistryError(
              'NOT_FOUND',
              input.version
                ? `${input.name}@${input.version} was not found`
                : `No version of ${input.name} runs on this editor (${deps.version})`,
            );
          }
          await installItem(registry, {
            name: input.name,
            version: version.version,
            type: 'plugin',
            target,
            sha256: version.sha256,
          });
          await deps.deactivateServerPlugin?.(input.name);
          const project = input.project ? projects.get(session, input.project) : undefined;
          const located = (await deps.plugins.list(project)).find(
            (plugin) => plugin.dir === target && plugin.manifest?.entry.server,
          );
          if (located) await deps.activateServerPlugin?.(located);
          return { version: version.version };
        }),
      uninstallPlugin: async (input, { session }) => {
        const target = pluginFolder(session, input);
        if (!existsSync(join(target, 'nanoforge.manifest.json')))
          throw new RpcError('NOT_FOUND', `${input.name} is not installed there`);
        await rm(target, { recursive: true, force: true });
        await deps.deactivateServerPlugin?.(input.name);
        return null;
      },
      packages: ({ project }, { session }) =>
        withRegistry(() => listPackages(packagesOf(session, project))),
      installPackage: ({ project, name, range }, { session }) =>
        withRegistry(async () => {
          const packages = packagesOf(session, project);
          await packages.install(name, range);
          return listPackages(packages);
        }),
      uninstallPackage: ({ project, name }, { session }) =>
        withRegistry(async () => {
          const packages = packagesOf(session, project);
          await packages.uninstall(name);
          return listPackages(packages);
        }),
      updatePackage: ({ project, name, latest }, { session }) =>
        withRegistry(async () => {
          const packages = packagesOf(session, project);
          await packages.update(name, latest);
          return listPackages(packages);
        }),
      restorePackages: ({ project }, { session }) =>
        withRegistry(async () => {
          const packages = packagesOf(session, project);
          await packages.restore();
          return listPackages(packages);
        }),
    },
  });
};
