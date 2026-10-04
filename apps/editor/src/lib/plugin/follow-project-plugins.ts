import {
  type Disposable,
  type Logger,
  type PluginDescriptor,
  type PluginHost,
  parsePluginManifest,
  toDisposable,
} from '@nanoforge-dev/editor-kernel';
import { type ProjectService } from '@nanoforge-dev/editor-project';
import { type PluginListing, PluginsContract } from '@nanoforge-dev/editor-protocol';
import { type RpcClient } from '@nanoforge-dev/editor-rpc';
import type { NotificationService } from '@nanoforge-dev/editor-ui';

export const toDescriptor = (
  listing: PluginListing,
  logger: Logger,
): PluginDescriptor | undefined => {
  if (listing.error) {
    logger.warn(`Plugin at ${listing.baseUrl} skipped: ${listing.error}`);
    return undefined;
  }
  try {
    return {
      source: listing.source,
      baseUrl: new URL(listing.baseUrl, location.origin).href,
      manifest: parsePluginManifest(listing.manifest, listing.baseUrl),
    };
  } catch (error) {
    logger.error(`Invalid plugin manifest at ${listing.baseUrl}`, error);
    return undefined;
  }
};

/**
 * The open project's own plugins (`.nanoforge/plugins`) join the plugin set while it is open.
 * Plugins that its packages suggest and that aren't installed are named in a notification, once
 * per project.
 */
export const followProjectPlugins = (options: {
  rpc: RpcClient;
  projects: ProjectService;
  plugins: PluginHost;
  notifications: NotificationService;
  logger: Logger;
}): Disposable => {
  const { rpc, plugins, logger } = options;
  const api = rpc.api(PluginsContract);

  const suggested = new Set<string>();
  let listedFor: string | undefined;
  let queue = Promise.resolve();

  const suggest = async (project: string) => {
    if (suggested.has(project)) return;
    suggested.add(project);
    const missing = (await api.suggestions({ project })).filter(
      (suggestion) => plugins.getPlugin(suggestion.name)?.status.kind !== 'ok',
    );
    if (!missing.length) return;
    const count = missing.length > 1 ? `${missing.length} plugins` : 'a plugin';
    options.notifications.notify('info', `Packages in this project suggest ${count}`, {
      detail: `${missing
        .map(
          ({ name, suggestedBy }) =>
            `${name} (for ${suggestedBy.map((entry) => entry.package).join(', ')})`,
        )
        .join(
          ', ',
        )}. Install a plugin in the project's .nanoforge/plugins, or in your home for every project.`,
      timeout: 15_000,
    });
  };

  const follow = (project: string | undefined) => {
    if (project === listedFor) return;
    listedFor = project;
    queue = queue
      .then(async () => {
        const listings = await api.list(project ? { project } : null);
        if (listedFor !== project) return;
        await plugins.update(listings.flatMap((listing) => toDescriptor(listing, logger) ?? []));
        if (project) await suggest(project);
      })
      .catch((error: unknown) => logger.error('Could not load the project plugins', error));
  };

  return toDisposable(options.projects.current.subscribe((project) => follow(project?.id)));
};
