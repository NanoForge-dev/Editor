import { z } from 'zod';

import {
  RegistryItem,
  RegistrySummary,
  RegistryVersion,
  SearchResult,
} from '@nanoforge-dev/registry/types';

export { RegistryItem, RegistrySummary, RegistryVersion, SearchResult as RegistrySearchResult };

/** A package of a project, as installed, with the newer versions the registry has. */
export const InstalledPackage = z.object({
  name: z.string(),
  version: z.string(),
  /** The range the project asks for; absent for a package only others need. */
  range: z.string().optional(),
  /** Installed packages that need it. */
  dependents: z.array(z.string()),
  /** Whether its folder is in `nf_modules`. */
  present: z.boolean(),
  /** The newest version its range allows, when newer. */
  wanted: z.string().optional(),
  /** The newest version of all, when newer. */
  latest: z.string().optional(),
});
export type InstalledPackage = z.output<typeof InstalledPackage>;

/** Where a plugin is installed: for the user (every project), or in one project. */
export const PluginScope = z.enum(['user', 'project']);
export type PluginScope = z.output<typeof PluginScope>;
