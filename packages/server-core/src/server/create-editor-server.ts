import { join, resolve } from 'node:path';

import { DisposableStore, LoggerService, consoleSink } from '@nanoforge-dev/editor-kernel';
import { decodeRuntimeApp } from '@nanoforge-dev/editor-protocol';
import { PROJECT_HEADER, RPC_HTTP_PREFIX, RPC_WS_PATH, RpcRouter } from '@nanoforge-dev/editor-rpc';

import { ApiClient } from '../api/api-client';
import { archiveFolder } from '../fs/archive';
import { PathJail } from '../fs/path-jail';
import { GitService } from '../git/git-service';
import { fileResponse } from '../http/static-files';
import { PluginSources } from '../plugin/plugin-sources';
import { ServerPluginHost, type ServerPluginServices } from '../plugin/server-plugins';
import { CliService } from '../process/cli-service';
import { ProjectRegistry } from '../project/project-registry';
import { implementCoreRpc } from '../rpc/implement-core-rpc';
import type { BuildOutput } from '../runtime/build-output';
import { RuntimeManager } from '../runtime/project-runtime';
import { type RequestContext, authorize } from '../session/auth';
import { serializeCookie } from '../session/cookies';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  type Session,
  SessionStore,
} from '../session/session-store';
import {
  ApiAccountBackend,
  FileAccountBackend,
  ProjectLocalSettingsStore,
} from '../settings/account-backends';
import type { EditorServer, EditorServerOptions } from './editor-server.type';

const json = (status: number, body: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const createEditorServer = (options: EditorServerOptions): EditorServer => {
  const { env } = options;
  const store = new DisposableStore();
  const logs = options.logger ?? new LoggerService();
  if (!options.logger) store.add(logs.addSink(consoleSink));
  const logger = logs.getLogger('server');

  const sessions = new SessionStore(env);
  const api = new ApiClient(env, options.fetch);
  const git = new GitService(env);
  const cli = new CliService(env);
  const projects = store.add(new ProjectRegistry(env, git, api, logs.getLogger('projects')));
  const plugins = new PluginSources(env, logs.getLogger('plugins'));
  const runtime = store.add(new RuntimeManager(cli, env, logs.getLogger('runtime')));
  const router = new RpcRouter<RequestContext>({
    authorize,
    onError: (error, call) => logger.error(`RPC ${call.namespace}.${call.name} failed`, error),
  });
  store.add(
    implementCoreRpc(router, {
      env,
      version: options.version,
      sessions,
      projects,
      plugins,
      activateServerPlugin: (plugin) => serverPlugins.activate(plugin),
      deactivateServerPlugin: (name) => serverPlugins.deactivate(name),
      cli,
      api,
      accountSettings:
        env.mode === 'ONLINE' && env.apiFeatures.includes('settings')
          ? new ApiAccountBackend(api)
          : new FileAccountBackend(env),
      projectLocalSettings: new ProjectLocalSettingsStore(env),
      runtime,
      git,
    }),
  );
  const services: ServerPluginServices = { projects, cli, git, api };
  const serverPlugins = store.add(new ServerPluginHost(router, services, logs));
  const staticJail = options.staticDir ? new PathJail(resolve(options.staticDir)) : undefined;
  const pruneTimer = setInterval(() => sessions.prune(), 3600_000);
  pruneTimer.unref?.();

  /** Blocks cross-site requests: a local editor must not be driven by random web pages. */
  const originAllowed = (request: Request): boolean => {
    const origin = request.headers.get('origin');
    if (!origin) return true; // non-browser clients
    const host = request.headers.get('host') ?? new URL(request.url).host;
    try {
      const url = new URL(origin);
      return url.host === host || env.allowedOrigins.includes(origin);
    } catch {
      return false;
    }
  };

  const withCookies = (response: Response, cookies: string[]): Response => {
    for (const cookie of cookies) response.headers.append('set-cookie', cookie);
    return response;
  };

  const tokenCookies = (session: Session, before: string | undefined): string[] => {
    if (!session.tokens || session.tokens.accessToken === before) return [];
    const secure = env.production;
    return [
      serializeCookie(ACCESS_TOKEN_COOKIE, session.tokens.accessToken, { secure }),
      serializeCookie(REFRESH_TOKEN_COOKIE, session.tokens.refreshToken, { secure }),
    ];
  };

  const handleRpc = async (request: Request, path: string): Promise<Response> => {
    const { session, setCookies } = sessions.resolve(request.headers.get('cookie'));
    const before = session.tokens?.accessToken;
    const context: RequestContext = { session, responseCookies: [] };
    const result = await router.handle(path, await request.text(), context, request.signal);
    const response = new Response(result.body, {
      status: result.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
    return withCookies(response, [
      ...setCookies,
      ...context.responseCookies,
      ...tokenCookies(session, before),
    ]);
  };

  const handlePlugin = async (request: Request, pathname: string): Promise<Response> => {
    const { session } = sessions.resolve(request.headers.get('cookie'));
    const resolved = await plugins.resolveFile(pathname, (projectId) => {
      try {
        projects.get(session, projectId);
        return true;
      } catch {
        return false;
      }
    });
    if (!resolved) return json(404, { error: 'Not found' });
    const cache =
      resolved.plugin.source === 'dev' ? 'no-cache' : 'public, max-age=31536000, immutable';
    return (await fileResponse(resolved.file, cache)) ?? json(404, { error: 'Not found' });
  };

  /** Build outputs of running games: `/runtime/<projectId>/<app>/<file>`. */
  const handleRuntime = async (request: Request, url: URL): Promise<Response> => {
    const [projectId, appSegment, ...rest] = url.pathname.slice('/runtime/'.length).split('/');
    if (!projectId || !appSegment || !rest.length || env.mode !== 'OFFLINE')
      return json(404, { error: 'Not found' });
    const { session } = sessions.resolve(request.headers.get('cookie'));
    let file: string | undefined;
    let output: BuildOutput;
    try {
      const projectRuntime = runtime.get(projects.get(session, projectId));
      output = projectRuntime.builds.output(projectRuntime.app(decodeRuntimeApp(appSegment)));
      file = await new PathJail(output.dir).resolve(rest.map(decodeURIComponent).join('/'));
    } catch {
      return json(404, { error: 'Not found' });
    }
    const version = url.searchParams.get('v');
    const cache =
      version && version === (await output.hash(file))
        ? 'public, max-age=31536000, immutable'
        : 'no-store';
    return (await fileResponse(file, cache)) ?? json(404, { error: 'Not found' });
  };

  /**
   * Files of an open project: `/files/<projectId>/<path>` (thumbnails, previews). With
   * `?download`, an attachment; a folder downloads as a .zip.
   */
  const handleFiles = async (request: Request, url: URL): Promise<Response> => {
    const [projectId, ...rest] = url.pathname.slice('/files/'.length).split('/');
    if (!projectId) return json(404, { error: 'Not found' });
    const { session } = sessions.resolve(request.headers.get('cookie'));
    const path = rest.map(decodeURIComponent).join('/');
    const download = url.searchParams.has('download');
    try {
      const project = projects.get(session, projectId);
      const entry = await project.fs.stat(path);
      if (!entry || (path && project.fs.isIgnored(path, entry.kind === 'directory'))) {
        return json(404, { error: 'Not found' });
      }
      const name = path.split('/').at(-1) || project.name;
      const disposition = (file: string) =>
        `attachment; filename="${file.replace(/["\\\r\n]/g, '_')}"`;
      if (entry.kind === 'directory') {
        if (!download) return json(400, { error: 'Folders can only be downloaded' });
        const archive = await archiveFolder(project.fs, path);
        return new Response(archive as Uint8Array<ArrayBuffer>, {
          headers: {
            'content-type': 'application/zip',
            'content-disposition': disposition(`${name}.zip`),
            'cache-control': 'no-store',
          },
        });
      }
      const response = await fileResponse(await project.fs.jail.resolve(path), 'no-cache');
      if (!response) return json(404, { error: 'Not found' });
      if (download) response.headers.set('content-disposition', disposition(name));
      return response;
    } catch {
      return json(404, { error: 'Not found' });
    }
  };

  const handleStatic = async (pathname: string): Promise<Response> => {
    if (!staticJail) return json(404, { error: 'Not found' });
    const rel = decodeURIComponent(pathname.slice(1));
    const file = await staticJail.resolve(rel).catch(() => undefined);
    const immutable = rel.startsWith('_app/immutable/');
    const asset =
      file &&
      (await fileResponse(file, immutable ? 'public, max-age=31536000, immutable' : 'no-cache'));
    if (asset) return asset;
    if (/\.[a-z0-9]+$/i.test(rel)) return json(404, { error: 'Not found' });
    return (
      (await fileResponse(join(staticJail.root, 'index.html'), 'no-cache')) ??
      json(404, { error: 'Not found' })
    );
  };

  return {
    env,
    router,
    projects,
    plugins,
    serverPlugins,
    logs,
    runtime,
    cli,

    async start() {
      for (const plugin of await plugins.list()) {
        if (plugin.manifest?.entry.server) await serverPlugins.activate(plugin);
      }
    },

    async fetch(request, upgrade) {
      const url = new URL(request.url);
      const { pathname } = url;
      try {
        if (pathname === '/healthz') return json(200, { ok: true, version: options.version });
        if (pathname === RPC_WS_PATH) {
          if (!originAllowed(request)) return json(403, { error: 'Forbidden origin' });
          const { session, setCookies } = sessions.resolve(request.headers.get('cookie'));
          const headers = new Headers();
          for (const cookie of setCookies) headers.append('set-cookie', cookie);
          if (upgrade?.(request, { data: { session }, headers })) return undefined;
          return json(426, { error: 'WebSocket upgrade required' });
        }
        if (pathname.startsWith(RPC_HTTP_PREFIX)) {
          if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
          if (!originAllowed(request)) return json(403, { error: 'Forbidden origin' });
          return await handleRpc(request, pathname.slice(RPC_HTTP_PREFIX.length));
        }
        if (request.method !== 'GET' && request.method !== 'HEAD')
          return json(405, { error: 'Method not allowed' });
        if (pathname.startsWith('/plugins/')) return await handlePlugin(request, pathname);
        if (pathname.startsWith('/runtime/')) return await handleRuntime(request, url);
        if (pathname.startsWith('/files/')) return await handleFiles(request, url);
        return await handleStatic(pathname);
      } catch (error) {
        logger.error(`${request.method} ${pathname} failed`, error);
        return json(500, { error: 'Internal error' });
      }
    },

    websocket: {
      open(socket) {
        socket.data.rpc = router.createSession(
          { session: socket.data.session, responseCookies: [] },
          (message) => socket.send(message) > 0,
        );
      },
      message(socket, message) {
        void socket.data.rpc?.receive(
          typeof message === 'string' ? message : new TextDecoder().decode(message),
        );
      },
      drain(socket) {
        socket.data.rpc?.drain();
      },
      close(socket) {
        socket.data.rpc?.dispose();
      },
    },

    dispose() {
      clearInterval(pruneTimer);
      store.dispose();
    },
  };
};

export { PROJECT_HEADER };
