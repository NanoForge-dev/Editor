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
import { parseCookies, serializeCookie } from '../session/cookies';
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
import { hostAllowed, originAllowed } from './request-guard';

/** A project nobody has a connected editor on is closed after this long without a request. */
const PROJECT_IDLE_MS = 30 * 60_000;
/** The account setting listing the hosted projects whose own plugins the user allowed. */
const TRUSTED_PROJECTS_SETTING = 'plugins.trustedProjects';
/** Plugin files loaded as scripts (a sandbox policy would not apply to them). */
const SCRIPT = /\.m?js$/i;

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

  const api = new ApiClient(env, options.fetch);
  const sessions = new SessionStore(env, { verify: (session) => api.currentUser(session) });
  const git = new GitService(env, undefined, (root) => projects.trust.isTrusted(root));
  const cli = new CliService(env);
  const projects: ProjectRegistry = store.add(
    new ProjectRegistry(env, git, api, logs.getLogger('projects')),
  );
  const plugins = new PluginSources(env, logs.getLogger('plugins'));
  const accountSettings =
    env.mode === 'ONLINE' && env.apiFeatures.includes('settings')
      ? new ApiAccountBackend(api)
      : new FileAccountBackend(env);
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
      deactivateServerPlugin: (name, dir) => serverPlugins.deactivate(name, dir),
      syncProjectServerPlugins: (located) => serverPlugins.syncProject(located),
      cli,
      api,
      accountSettings,
      projectLocalSettings: new ProjectLocalSettingsStore(env),
      runtime,
      git,
    }),
  );
  const services: ServerPluginServices = { projects, cli, git, api };
  const serverPlugins = store.add(new ServerPluginHost(router, services, logs));
  const staticJail = options.staticDir ? new PathJail(resolve(options.staticDir)) : undefined;
  store.add(projects.onDidClose((id) => runtime.close(id)));
  const inUse = (id: string) => sessions.holders(id).some((session) => session.sockets > 0);
  const sweepTimer = setInterval(() => {
    sessions.prune();
    projects.sweep(inUse, PROJECT_IDLE_MS);
  }, 600_000);
  sweepTimer.unref?.();

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
    const cookie = request.headers.get('cookie');
    const before = parseCookies(cookie)[ACCESS_TOKEN_COOKIE];
    const { session, setCookies } = await sessions.resolve(cookie);
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

  /**
   * Whether a session may load a project's own plugins, as the client decides: a local folder
   * that is trusted, or a hosted project its user allowed (`plugins.trustedProjects`). Checked
   * here too, or a direct link would load them anyway.
   */
  const mayLoadProjectPlugins = async (session: Session, projectId: string) => {
    try {
      const project = projects.get(session, projectId);
      if (env.mode === 'OFFLINE') return project.trusted;
      const allowed = (await accountSettings.get(session)).values[TRUSTED_PROJECTS_SETTING];
      return Array.isArray(allowed) && allowed.includes(projectId);
    } catch {
      return false;
    }
  };

  const handlePlugin = async (request: Request, pathname: string): Promise<Response> => {
    const { session } = await sessions.resolve(request.headers.get('cookie'), { create: false });
    const resolved = await plugins.resolveFile(pathname, (projectId) =>
      mayLoadProjectPlugins(session, projectId),
    );
    if (!resolved) return json(404, { error: 'Not found' });
    const cache = {
      dev: 'no-cache',
      project: 'private, no-cache',
      installed: 'public, max-age=31536000, immutable',
      bundled: 'public, max-age=31536000, immutable',
    }[resolved.plugin.source];
    const response = await fileResponse(
      resolved.file,
      cache,
      request.headers.get('accept-encoding'),
    );
    if (!response) return json(404, { error: 'Not found' });
    /** A project's page or image opened on its own runs nothing on the editor's origin. */
    if (resolved.plugin.source === 'project' && !SCRIPT.test(resolved.file))
      response.headers.set('content-security-policy', 'sandbox');
    return response;
  };

  /**
   * Build outputs of running games: `/runtime/<projectId>/<app>/<file>`. Local editors only, like
   * the runtime RPC: a hosted editor never builds nor runs a project's code.
   */
  const handleRuntime = async (request: Request, url: URL): Promise<Response> => {
    const [projectId, appSegment, ...rest] = url.pathname.slice('/runtime/'.length).split('/');
    if (!projectId || !appSegment || !rest.length || env.mode !== 'OFFLINE')
      return json(404, { error: 'Not found' });
    const { session } = await sessions.resolve(request.headers.get('cookie'), { create: false });
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
    return (
      (await fileResponse(file, cache, request.headers.get('accept-encoding'))) ??
      json(404, { error: 'Not found' })
    );
  };

  /**
   * Files of an open project: `/files/<projectId>/<path>` (thumbnails, previews). With
   * `?download`, an attachment; a folder downloads as a .zip.
   */
  const handleFiles = async (request: Request, url: URL): Promise<Response> => {
    const [projectId, ...rest] = url.pathname.slice('/files/'.length).split('/');
    if (!projectId) return json(404, { error: 'Not found' });
    const { session } = await sessions.resolve(request.headers.get('cookie'), { create: false });
    const download = url.searchParams.has('download');
    try {
      const path = rest.map(decodeURIComponent).join('/');
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
      response.headers.set('content-security-policy', 'sandbox');
      if (download) response.headers.set('content-disposition', disposition(name));
      return response;
    } catch {
      return json(404, { error: 'Not found' });
    }
  };

  /**
   * Only the editor's own pages may frame it: another site framing a local editor could get a
   * click on "Trust and open" (or any other button) without the user seeing what it does.
   */
  const notFramed = (response: Response | undefined) => {
    response?.headers.set('content-security-policy', "frame-ancestors 'self'");
    response?.headers.set('x-frame-options', 'SAMEORIGIN');
    return response;
  };

  const handleStatic = async (request: Request, pathname: string): Promise<Response> => {
    const accept = request.headers.get('accept-encoding');
    if (!staticJail) return json(404, { error: 'Not found' });
    let rel: string;
    try {
      rel = decodeURIComponent(pathname.slice(1));
    } catch {
      return json(404, { error: 'Not found' });
    }
    const file = await staticJail.resolve(rel).catch(() => undefined);
    const immutable = rel.startsWith('_app/immutable/');
    const asset =
      file &&
      (await fileResponse(
        file,
        immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        accept,
      ));
    if (asset) return notFramed(asset)!;
    if (/\.[a-z0-9]+$/i.test(rel)) return json(404, { error: 'Not found' });
    return (
      notFramed(await fileResponse(join(staticJail.root, 'index.html'), 'no-cache', accept)) ??
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
        if (!hostAllowed(env, request.headers.get('host') ?? url.host))
          return json(421, { error: 'Unknown host' });
        if (!originAllowed(env, request)) return json(403, { error: 'Forbidden origin' });
        if (pathname === RPC_WS_PATH) {
          const { session, setCookies } = await sessions.resolve(request.headers.get('cookie'));
          const headers = new Headers();
          for (const cookie of setCookies) headers.append('set-cookie', cookie);
          if (upgrade?.(request, { data: { session }, headers })) return undefined;
          return json(426, { error: 'WebSocket upgrade required' });
        }
        if (pathname.startsWith(RPC_HTTP_PREFIX)) {
          if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
          return await handleRpc(request, pathname.slice(RPC_HTTP_PREFIX.length));
        }
        if (request.method !== 'GET' && request.method !== 'HEAD')
          return json(405, { error: 'Method not allowed' });
        if (pathname.startsWith('/plugins/')) return await handlePlugin(request, pathname);
        if (pathname.startsWith('/runtime/')) return await handleRuntime(request, url);
        if (pathname.startsWith('/files/')) return await handleFiles(request, url);
        return await handleStatic(request, pathname);
      } catch (error) {
        logger.error(`${request.method} ${pathname} failed`, error);
        return json(500, { error: 'Internal error' });
      }
    },

    websocket: {
      open(socket) {
        socket.data.session.sockets++;
        socket.data.rpc = router.createSession(
          { session: socket.data.session, responseCookies: [] },
          (message) => socket.send(message) > 0,
        );
      },
      message(socket, message) {
        socket.data.rpc
          ?.receive(typeof message === 'string' ? message : new TextDecoder().decode(message))
          .catch((error: unknown) => logger.error('WebSocket message failed', error));
      },
      drain(socket) {
        socket.data.rpc?.drain();
      },
      close(socket) {
        socket.data.session.sockets = Math.max(0, socket.data.session.sockets - 1);
        socket.data.rpc?.dispose();
      },
    },

    dispose() {
      clearInterval(sweepTimer);
      sessions.dispose();
      store.dispose();
    },
  };
};

export { PROJECT_HEADER };
