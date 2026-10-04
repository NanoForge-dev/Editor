import type { ApiFeature } from './env.schema';

export interface EditorEnv {
  readonly production: boolean;
  readonly mode: 'OFFLINE' | 'ONLINE';
  readonly host: string;
  readonly port: number;
  readonly fsRoot: string;
  readonly dataDir: string;
  readonly apiUrl: string;
  readonly apiKey: string | undefined;
  /** The API features the editor may call. */
  readonly apiFeatures: readonly ApiFeature[];
  /** Undefined: no registry to ask (the API does not have it yet). */
  readonly registryUrl: string | undefined;
  /** A folder used as the registry, when set. */
  readonly registryDir: string | undefined;
  readonly loginUrl: string;
  readonly sessionSecret: string;
  readonly cliPath: string | undefined;
  readonly gitPath: string;
  readonly allowedOrigins: readonly string[];
  readonly devPlugins: readonly string[];
  readonly bundledPluginsDir: string | undefined;
}
