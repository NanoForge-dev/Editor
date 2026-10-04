import { z } from 'zod';

import { defineContract } from '@nanoforge-dev/editor-rpc';
import { ItemName, ItemType, RegistryItem, SearchResult } from '@nanoforge-dev/registry/types';

import { ProjectId } from '../project/project.schema';
import { InstalledPackage, PluginScope } from './registry.schema';

const PluginTarget = z.object({
  name: ItemName,
  scope: PluginScope,
  /** The project, for the `project` scope. */
  project: ProjectId.optional(),
});
const ProjectPackage = z.object({ project: ProjectId, name: ItemName });

/**
 * The registry of plugins and packages, and installing from it (local editors only for
 * installs). Fails with `UNAVAILABLE` when the registry cannot be reached.
 */
export const RegistryContract = defineContract('registry', {
  methods: {
    search: {
      input: z.object({
        type: ItemType,
        q: z.string().default(''),
        page: z.number().int().min(1).default(1),
      }),
      output: SearchResult,
    },
    /** An item with its readme and versions; `compatible` is the newest this editor can run. */
    details: {
      input: z.object({ name: ItemName }),
      output: RegistryItem.extend({ compatible: z.string().optional() }),
    },
    /** Installs the newest version this editor can run, or `version`. Takes effect on reload. */
    installPlugin: {
      input: PluginTarget.extend({ version: z.string().optional() }),
      output: z.object({ version: z.string() }),
    },
    uninstallPlugin: { input: PluginTarget, output: z.null() },
    /** The packages of a project (from its lock), with what is newer in the registry. */
    packages: { input: z.object({ project: ProjectId }), output: z.array(InstalledPackage) },
    installPackage: {
      input: ProjectPackage.extend({ range: z.string().optional() }),
      output: z.array(InstalledPackage),
    },
    uninstallPackage: { input: ProjectPackage, output: z.array(InstalledPackage) },
    /** To the newest version in its range, or to the newest of all with `latest`. */
    updatePackage: {
      input: ProjectPackage.extend({ latest: z.boolean().default(false) }),
      output: z.array(InstalledPackage),
    },
    /** Installs what the lock lists and `nf_modules` lacks. */
    restorePackages: { input: z.object({ project: ProjectId }), output: z.array(InstalledPackage) },
  },
});
