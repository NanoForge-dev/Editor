import { type Disposable, type LoggerService } from '@nanoforge-dev/editor-kernel';
import { type RpcRouter, type RpcSession } from '@nanoforge-dev/editor-rpc';

import type { EditorEnv } from '../env/editor-env.type';
import { type PluginSources } from '../plugin/plugin-sources';
import { type ServerPluginHost } from '../plugin/server-plugins';
import { type CliService } from '../process/cli-service';
import { type ProjectRegistry } from '../project/project-registry';
import { type RuntimeManager } from '../runtime/project-runtime';
import type { RequestContext } from '../session/auth';
import type { Session } from '../session/session-store';

export interface SocketData {
  readonly session: Session;
  rpc?: RpcSession;
}

/** The part of a WebSocket the server needs (Bun's ServerWebSocket satisfies it). */
export interface ServerSocket {
  readonly data: SocketData;
  /** Bun returns -1 under back-pressure, 0 when dropped, the byte count otherwise. */
  send(message: string): number;
  close(): void;
}

export type Upgrade = (
  request: Request,
  options: { data: SocketData; headers?: HeadersInit },
) => boolean;

export interface EditorServerOptions {
  env: EditorEnv;
  version: string;
  /** Built SPA (index.html + assets). Omitted in dev, where Vite serves the UI. */
  staticDir?: string;
  fetch?: typeof fetch;
  logger?: LoggerService;
}

export interface EditorServer extends Disposable {
  readonly env: EditorEnv;
  readonly router: RpcRouter<RequestContext>;
  readonly projects: ProjectRegistry;
  readonly plugins: PluginSources;
  readonly serverPlugins: ServerPluginHost;
  readonly logs: LoggerService;
  readonly runtime: RuntimeManager;
  readonly cli: CliService;
  readonly websocket: {
    open(socket: ServerSocket): void;
    message(socket: ServerSocket, message: string | Uint8Array): void;
    drain(socket: ServerSocket): void;
    close(socket: ServerSocket): void;
  };
  /** Activates plugin server entries. */
  start(): Promise<void>;
  /** HTTP handler; returns undefined when the request was upgraded to a WebSocket. */
  fetch(request: Request, upgrade?: Upgrade): Promise<Response | undefined>;
}
