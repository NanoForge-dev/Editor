import type { Container, Disposable } from '@nanoforge-dev/editor-kernel';
import {
  IndexedDbTreeCache,
  OpfsContentCache,
  ProjectCaches,
  ProjectCachesToken,
  type ProjectService,
  removeOtherUsers,
  removeStaleOpfs,
} from '@nanoforge-dev/editor-project';
import type { SessionInfo } from '@nanoforge-dev/editor-protocol';
import { CoreSettings, type SettingsService } from '@nanoforge-dev/editor-settings';

/** Upkeep runs this long after a project opens, when the start is over. */
const SWEEP_DELAY_MS = 15_000;

export interface FollowProjectCachesOptions {
  readonly services: Container;
  readonly projects: ProjectService;
  readonly settings: SettingsService;
  readonly session: SessionInfo;
}

/**
 * Keeps the files of opened projects in the browser (OPFS and IndexedDB), per user, within the
 * Storage settings. A hosted editor removes what other users left on this browser (a shared
 * computer). Without the storage APIs, files are only kept while the page lives.
 */
export const followProjectCaches = ({
  services,
  projects,
  settings,
  session,
}: FollowProjectCachesOptions): Disposable => {
  if (!OpfsContentCache.isSupported() || !IndexedDbTreeCache.isSupported())
    return { dispose: () => undefined };
  const user = session.user?.id ?? 'local';
  const online = session.mode === 'ONLINE';
  void removeStaleOpfs(online ? user : undefined);
  if (online) void removeOtherUsers(user);
  const caches = new ProjectCaches(user, new OpfsContentCache(user), {
    budgetBytes: () => settings.get(CoreSettings.cacheBudget) * 1024 * 1024,
    maxAgeDays: () => settings.get(CoreSettings.cacheMaxAge),
  });
  projects.useCaches(caches);
  services.provide(ProjectCachesToken, caches);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = projects.current.subscribe((project) => {
    clearTimeout(timer);
    if (project)
      timer = setTimeout(() => void caches.sweep().catch(() => undefined), SWEEP_DELAY_MS);
  });
  return {
    dispose: () => {
      clearTimeout(timer);
      unsubscribe();
      caches.dispose();
    },
  };
};
