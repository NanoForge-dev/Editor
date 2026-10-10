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
import { CoreSettings, type SettingsService } from '@nanoforge-dev/editor-settings';
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
 *
 * On a hosted editor (`online`) a project is shared: anyone who can change it can change its
 * plugins, which would run in the others' editors. They load only for the projects the user
 * allowed (`plugins.trustedProjects`); otherwise a notification names them and offers to.
 */
export const followProjectPlugins = (options: {
  rpc: RpcClient;
  projects: ProjectService;
  plugins: PluginHost;
  notifications: NotificationService;
  logger: Logger;
  settings: SettingsService;
  online: boolean;
}): Disposable => {
  const { rpc, plugins, logger, settings } = options;
  const api = rpc.api(PluginsContract);

  const suggested = new Set<string>();
  const offered = new Set<string>();
  let listedFor: string | undefined;
  let queue = Promise.resolve();

  const trusted = (project: string) =>
    !options.online || settings.get(CoreSettings.pluginsTrustedProjects).includes(project);

  /** Keeps a hosted project's own plugins out until allowed, and offers to allow them. */
  const allowed = (project: string | undefined, listings: readonly PluginListing[]) => {
    if (!project || trusted(project)) return listings;
    const own = listings.filter((listing) => listing.source === 'project');
    if (own.length && !offered.has(project)) {
      offered.add(project);
      const names = own
        .map((listing) => (listing.manifest as { name?: string } | null)?.name ?? listing.baseUrl)
        .join(', ');
      options.notifications.notify('warning', 'This project has its own plugins', {
        detail: `${names}. They would run in your editor, and anyone who can change the project can change them.`,
        actions: [
          {
            title: 'Allow its plugins',
            run: async () => {
              const list = settings.get(CoreSettings.pluginsTrustedProjects);
              await settings.set(
                CoreSettings.pluginsTrustedProjects,
                [...list, project],
                'account',
              );
              listedFor = undefined;
              follow(options.projects.current.get()?.id);
            },
          },
        ],
        timeout: 0,
      });
    }
    return listings.filter((listing) => listing.source !== 'project');
  };

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

  function follow(project: string | undefined) {
    if (project === listedFor) return;
    listedFor = project;
    queue = queue
      .then(async () => {
        const listings = await api.list(project ? { project } : null);
        if (listedFor !== project) return;
        await plugins.update(
          allowed(project, listings).flatMap((listing) => toDescriptor(listing, logger) ?? []),
        );
        if (project) await suggest(project);
      })
      .catch((error: unknown) => logger.error('Could not load the project plugins', error));
  }

  return toDisposable(options.projects.current.subscribe((project) => follow(project?.id)));
};
