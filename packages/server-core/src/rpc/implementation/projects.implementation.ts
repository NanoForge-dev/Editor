import { existsSync } from 'node:fs';
import { cp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { type Disposable, observe } from '@nanoforge-dev/editor-kernel';
import { ProjectsContract } from '@nanoforge-dev/editor-protocol';
import { RpcError, type RpcRouter } from '@nanoforge-dev/editor-rpc';

import type { RequestContext } from '../../session/auth';
import type { CoreRpcDependencies } from '../core-rpc.type';
import { packageManagerOf } from '../package-manager-of';
import { requireUser } from '../require-user';

/** A file of the tutorial's sources (`apps/editor/tutorial`): a folder that has it is the tutorial's project. */
const TUTORIAL_MARKER = 'src/systems/move-2d.system.ts';

/** Implements the projects contract. */
export const implementProjectsRpc = (
  router: RpcRouter<RequestContext>,
  deps: CoreRpcDependencies,
): Disposable => {
  const { env, projects } = deps;

  /** Tutorial projects being made, by folder name: a second call waits for the first. */
  const tutorials = new Map<string, Promise<void>>();

  /**
   * Makes the tutorial's project in `name`, unless it is already there: a folder of that name is
   * the tutorial's only when it has the tutorial's own file.
   */
  const makeTutorial = async (name: string, install: boolean) => {
    const root = join(env.fsRoot, name);
    if (existsSync(root)) {
      if (existsSync(join(root, TUTORIAL_MARKER))) return;
      throw new RpcError(
        'CONFLICT',
        `A folder named ${name} already exists and is not the tutorial's project: move it away to make the tutorial's project`,
      );
    }
    if (!env.tutorialDir || !existsSync(env.tutorialDir))
      throw new RpcError('INTERNAL', 'This editor was built without the tutorial files');
    await newProject({
      name,
      language: 'ts',
      server: false,
      install: false,
      packageManager: 'npm',
      strict: false,
    });
    /** An old CLI writes nanoforge.config.json and client/: the tutorial's files don't fit. */
    if (!existsSync(join(root, 'nanoforge.config.ts'))) {
      await rm(root, { recursive: true, force: true });
      throw new RpcError(
        'PRECONDITION_FAILED',
        'The NanoForge CLI that made the project is too old for the editor (it wrote no nanoforge.config.ts): update it (npm install -g @nanoforge-dev/cli), then start the tutorial again',
      );
    }
    await cp(env.tutorialDir, root, { recursive: true, force: true });
    await addEditorLibraryDependency(join(root, 'package.json'));
    await ignoreBuildOutput(join(root, '.gitignore'));
    await projects.trust.trust(await realpath(root));
    if (install) {
      const result = await deps.cli.exec('npm', ['install'], { cwd: root }).done;
      if (result.exitCode !== 0)
        throw new RpcError(
          'INTERNAL',
          'The tutorial project was made, but installing its dependencies failed: open it and use Install dependencies on the Project screen',
        );
    }
  };

  /** `nf new` in the root folder, given every option: the server has no terminal to answer. */
  const newProject = async (options: {
    name: string;
    language: 'ts' | 'js';
    server: boolean;
    install: boolean;
    packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
    /** Strict TypeScript (default): the tutorial's beginners get the lenient one. */
    strict?: boolean;
  }) => {
    const run = deps.cli.run(
      [
        'new',
        '--name',
        options.name,
        '--path',
        options.name,
        '--language',
        options.language,
        '--package-manager',
        options.packageManager,
        options.strict === false ? '--no-strict' : '--strict',
        options.server ? '--server' : '--no-server',
        '--no-git',
        '--no-docker',
        options.install ? '--no-skip-install' : '--skip-install',
      ],
      { cwd: env.fsRoot },
    );
    const result = await run.done;
    if (result.exitCode === 0) return;
    const output = (result.stderr || result.stdout).slice(-2000);
    const reason = output
      // eslint-disable-next-line no-control-regex
      .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);
    throw new RpcError('INTERNAL', `nf new failed${reason ? `: ${reason}` : ''}`, { output });
  };

  return router.implement(ProjectsContract, {
    methods: {
      open: async (ref, { session }) => {
        const project = await projects.open(session, ref);
        return { id: project.id, name: project.name, trusted: project.trusted };
      },
      isTrusted: ({ id }, { session }) => projects.get(session, id).trusted,
      trust: async ({ id }, { session }) => {
        await projects.trustProject(projects.get(session, id));
        return null;
      },
      recent: (_input, context) => projects.recent(requireUser(context)),
      forget: async ({ id }, context) => {
        await projects.forget(requireUser(context), id);
        return null;
      },
      model: ({ id }, { session }) => projects.get(session, id).model.get(),
      install: async ({ id }, { session }) => {
        if (env.mode !== 'OFFLINE')
          throw new RpcError('FORBIDDEN', 'Dependencies are installed in local editors only');
        const open = projects.get(session, id);
        projects.assertTrusted(open, 'Installing dependencies');
        const { root } = open;
        const manager = packageManagerOf(root);
        if (!manager) return { manager: null, ok: false };
        const result = await deps.cli.exec(manager, ['install'], { cwd: root }).done;
        return { manager, ok: result.exitCode === 0 };
      },
      create: async ({ name, language, server, install, packageManager }, { session }) => {
        if (env.mode !== 'OFFLINE')
          throw new RpcError('FORBIDDEN', 'Create projects from the NanoForge website');
        if (existsSync(join(env.fsRoot, name)))
          throw new RpcError('CONFLICT', `A folder named ${name} already exists`);
        await newProject({ name, language, server, install, packageManager });
        await projects.trust.trust(await realpath(join(env.fsRoot, name)));
        const project = await projects.open(session, { path: name });
        return { id: project.id, name: project.name, trusted: project.trusted };
      },
      createTutorial: async ({ name, install }, { session }) => {
        if (env.mode !== 'OFFLINE')
          throw new RpcError('FORBIDDEN', 'The tutorial project is made by local editors');
        let making = tutorials.get(name);
        if (!making) {
          making = makeTutorial(name, install).finally(() => tutorials.delete(name));
          tutorials.set(name, making);
        }
        await making;
        const project = await projects.open(session, { path: name });
        return { id: project.id, name: project.name, trusted: project.trusted };
      },
      gateways: async (_input, { session }) =>
        env.mode === 'ONLINE'
          ? (await deps.api.gatewayProjects(session)).map((project) => ({
              gatewayId: project.id,
              name: project.name,
              description: project.description,
            }))
          : [],
    },
    streams: {
      model: ({ id }, { session }, sink) =>
        observe(projects.get(session, id).model, (model) => sink.emit(model)),
    },
  });
};

/**
 * Adds `@nanoforge-dev/editor-lib` to a game's dependencies, in the range of its core library
 * (the tutorial's game registers the editor library).
 */
const addEditorLibraryDependency = async (file: string): Promise<void> => {
  const json = JSON.parse(await readFile(file, 'utf8')) as Record<
    string,
    Record<string, string> | undefined
  >;
  const field = json.dependencies?.['@nanoforge-dev/core'] ? 'dependencies' : 'devDependencies';
  const deps = { ...json[field] };
  deps['@nanoforge-dev/editor-lib'] ??= deps['@nanoforge-dev/core'] ?? '^2.0.0';
  json[field] = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(file, `${JSON.stringify(json, null, 2)}\n`);
};

/** Keeps the game's build (`dist/`) out of the tutorial's first commit. */
const ignoreBuildOutput = async (file: string): Promise<void> => {
  const text = existsSync(file) ? await readFile(file, 'utf8') : '';
  if (text.split('\n').some((line) => ['dist', 'dist/', '/dist', '/dist/'].includes(line.trim())))
    return;
  await writeFile(file, `${text}${text && !text.endsWith('\n') ? '\n' : ''}dist/\n`);
};
