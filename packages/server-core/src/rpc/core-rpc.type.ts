import type { ApiClient } from '../api/api-client';
import type { EditorEnv } from '../env/editor-env.type';
import type { GitService } from '../git/git-service';
import type { LocatedPlugin, PluginSources } from '../plugin/plugin-sources';
import type { CliService } from '../process/cli-service';
import type { ProjectRegistry } from '../project/project-registry';
import type { RuntimeManager } from '../runtime/project-runtime';
import type { SessionStore } from '../session/session-store';
import type {
  AccountSettingsBackend,
  ProjectLocalSettingsStore,
} from '../settings/account-backends';

export interface CoreRpcDependencies {
  readonly env: EditorEnv;
  readonly version: string;
  readonly sessions: SessionStore;
  readonly projects: ProjectRegistry;
  readonly plugins: PluginSources;
  /** Runs a project plugin's server entry (local editors only). */
  readonly activateServerPlugin?: (plugin: LocatedPlugin) => Promise<void>;
  /** Stops a plugin's server entry (it was uninstalled, or is being replaced). */
  readonly deactivateServerPlugin?: (name: string) => Promise<void>;
  readonly accountSettings: AccountSettingsBackend;
  readonly cli: CliService;
  readonly api: ApiClient;
  readonly projectLocalSettings: ProjectLocalSettingsStore;
  readonly runtime: RuntimeManager;
  readonly git: GitService;
}
