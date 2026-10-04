import type { LogLocation, LogValue, Logger } from '@nanoforge-dev/editor-kernel';
import type { AppModel, BuildDiagnostic } from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';

import type { GameClientModule } from '../client/game-client-runner.type';
import type { GameCompatibility } from '../compatibility/game-compatibility.type';

/** What runs on play: the client in the Game screen, the game server, or both. */
export type PlayMode = 'client' | 'server' | 'server+client';

export type PlayState =
  'idle' | 'building' | 'starting' | 'running' | 'paused' | 'stopping' | 'crashed';

export interface PlaySession {
  readonly state: PlayState;
  readonly mode: PlayMode | undefined;
  /** Apps being played. */
  readonly apps: readonly string[];
  /** Every running game answered the bridge hello: pause, resume and step are available. */
  readonly controllable: boolean;
  /** Protocol check of each running game (set once they run). */
  readonly compatibility: readonly GameCompatibility[];
  /** Why the session crashed. */
  readonly error?: string;
  readonly diagnostics?: readonly BuildDiagnostic[];
}

export interface RuntimeLog {
  /** `cli`: a command the editor server ran in the project (`app` is then its command line). */
  readonly source: 'build' | 'server' | 'client' | 'cli';
  readonly app: string;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly text: string;
  /** The logged values (game clients whose engine sends them): `text` is their one-line form. */
  readonly values?: readonly LogValue[];
  /** Where the game logged it: a position in its built bundle (see `sourceLocation`). */
  readonly location?: LogLocation;
}

/** An engine → editor event of a running game. */
export interface GameEvent {
  readonly source: 'client' | 'server';
  readonly app: string;
  readonly event: string;
  readonly args: readonly unknown[];
}

export interface RuntimeServiceOptions {
  readonly projectId: string;
  readonly rpc: RpcClient;
  /** Apps of the project (current project model). */
  readonly apps: () => readonly AppModel[];
  readonly logger: Logger;
  /** Default play mode (`runtime.playMode` setting); `auto` plays the server when there is one. */
  readonly playMode?: () => PlayMode | 'auto';
  /**
   * The app to play of a type, by id, in a project with several clients or servers
   * (`runtime.clientApp`, `runtime.serverApp`). Nothing, or an app that is gone: the first one.
   */
  readonly selectedApp?: (type: 'client' | 'server') => string | undefined;
  /** `NANOFORGE_*` overrides (`runtime.env` setting). */
  readonly envOverrides?: () => Record<string, string>;
  readonly importModule?: (url: string) => Promise<GameClientModule>;
  readonly origin?: string;
  /** Reads a file of the build output (source maps); `fetch` by default. */
  readonly fetchText?: (url: string) => Promise<string | undefined>;
  /** How long a started game may take to say hello before it is played without the bridge. */
  readonly helloTimeoutMs?: number;
  /** How long a started game server may take to report it runs. */
  readonly serverStartTimeoutMs?: number;
}
