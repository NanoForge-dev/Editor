import type { AppModel, ProjectModel } from '@nanoforge-dev/editor-protocol';
import type { WorkspaceIo } from '../../src/workspace/workspace.type';

/** A project in memory: files by path. */
export const memory = (initial: Record<string, string>) => {
  const files = new Map(Object.entries(initial));
  const under = (path: string) => [...files.keys()].filter((key) => key.startsWith(`${path}/`));
  const io: WorkspaceIo = {
    exists: (path) => files.has(path) || under(path).length > 0,
    files: () => [...files.keys()],
    read: async (path) => {
      const text = files.get(path);
      if (text === undefined) throw new Error(`no file ${path}`);
      return text;
    },
    write: async (path, text) => void files.set(path, text),
    remove: async (path) => {
      const removed = [path, ...under(path)].flatMap((key) =>
        files.has(key) ? [[key, files.get(key)!] as const] : [],
      );
      for (const [key] of removed) files.delete(key);
      return async () => {
        for (const [key, text] of removed) files.set(key, text);
      };
    },
    copy: async (from, to) => {
      for (const key of under(from)) files.set(`${to}${key.slice(from.length)}`, files.get(key)!);
    },
  };
  return { io, files, snapshot: () => Object.fromEntries([...files].sort()) };
};

export const editPackage = async (
  files: Map<string, string>,
  path: string,
  name: string,
  range: string,
) => {
  const pkg = JSON.parse(files.get(path)!) as { devDependencies: Record<string, string> };
  pkg.devDependencies[name] = range;
  files.set(path, `${JSON.stringify(pkg, null, 2)}\n`);
};

export const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
export const app = (root: string, name: string, type: AppModel['type']): AppModel => ({
  id: root,
  name,
  type,
  root,
  language: 'ts',
  dirs: {
    assets: '',
    components: `${root}/src/components`,
    systems: `${root}/src/systems`,
    scenes: '',
  },
  engineLibs: {},
  libraries: [],
});
export const client = app('apps/client', 'pong-client', 'client');
export const shared = app('libs/shared', '@pong/shared', 'lib');
export const server = app('apps/server', 'pong-server', 'server');
export const model = (...apps: AppModel[]): ProjectModel =>
  ({ id: 'p', name: 'pong', location: '/pong', apps, diagnostics: [] }) as ProjectModel;

export const project = () =>
  memory({
    'nanoforge.config.ts':
      'import { defineConfig } from "@nanoforge-dev/config";\n\nexport default defineConfig({\n  type: "workspace",\n  packages: ["apps/*"],\n});\n',
    'tsconfig.json': '{\n  // shared options\n  "compilerOptions": {\n    "strict": true\n  }\n}\n',
    'apps/client/package.json': json({
      name: 'pong-client',
      devDependencies: {
        '@nanoforge-dev/core': '^2.0.0',
        '@nanoforge-dev/ecs': '^2.0.0',
        typescript: '^6.0.0',
        eslint: '^10.0.0',
      },
    }),
    'apps/client/nanoforge.config.ts':
      'import { defineConfig } from "@nanoforge-dev/config";\n\nexport default defineConfig({\n  type: "client",\n});\n',
    'apps/client/tsconfig.json': '{ "extends": "../../tsconfig.json" }\n',
    'apps/client/src/main.ts': 'export const main = 1;\n',
    'apps/client/dist/main.js': 'built',
    'apps/server/package.json': json({ name: 'pong-server' }),
    'apps/server/nanoforge.config.ts': "export default { type: 'server', libs: [] };\n",
    'apps/server/src/main.ts': 'export const main = 2;\n',
  });
