import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as bundledPrettier from 'prettier';
import { parse as parseYaml } from 'yaml';

import { RpcError } from '@nanoforge-dev/editor-rpc';

type Prettier = Pick<typeof bundledPrettier, 'format' | 'getFileInfo' | 'resolveConfig'>;

export interface FormatResult {
  readonly text: string;
  readonly formatter: 'project' | 'bundled' | 'none';
}

/** Static Prettier configs (no code): what hosted editors may read. */
const STATIC_CONFIGS = ['.prettierrc', '.prettierrc.json', '.prettierrc.yaml', '.prettierrc.yml'];

/**
 * Formats files with Prettier.
 *
 * - `project`: the project's Prettier, config and plugins (executes project code, local only).
 * - `static`: the bundled Prettier with the closest JSON/YAML config, without plugins.
 */
export class Formatter {
  private readonly _projectPrettier = new Map<string, Promise<Prettier | undefined>>();

  constructor(private readonly _mode: 'project' | 'static') {}

  async format(root: string, absolute: string, text: string): Promise<FormatResult> {
    const project = this._mode === 'project' ? await this._resolveProject(absolute) : undefined;
    const prettier: Prettier = project ?? bundledPrettier;
    const ignorePath = join(root, '.prettierignore');
    const info = await prettier
      .getFileInfo(absolute, { ignorePath, resolveConfig: false })
      .catch(() => ({ ignored: false, inferredParser: null }));
    if (info.ignored || !info.inferredParser) return { text, formatter: 'none' };
    const config = project
      ? await prettier.resolveConfig(absolute, { editorconfig: true })
      : await readStaticConfig(root, absolute);
    try {
      const formatted = await prettier.format(text, { ...config, filepath: absolute });
      return { text: formatted, formatter: project ? 'project' : 'bundled' };
    } catch (error) {
      throw new RpcError(
        'BAD_REQUEST',
        `Prettier could not format the file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** The Prettier installed for the file (closest node_modules), else undefined. */
  private _resolveProject(absolute: string): Promise<Prettier | undefined> {
    const from = dirname(absolute);
    let prettier = this._projectPrettier.get(from);
    if (!prettier) {
      prettier = (async () => {
        try {
          const entry = createRequire(join(from, 'noop.js')).resolve('prettier');
          const module = (await import(pathToFileURL(entry).href)) as Partial<Prettier> & {
            default?: Prettier;
          };
          return typeof module.format === 'function' ? (module as Prettier) : module.default;
        } catch {
          return undefined;
        }
      })();
      this._projectPrettier.set(from, prettier);
    }
    return prettier;
  }
}

/** The closest static config from the file up to the project root, without plugins. */
const readStaticConfig = async (root: string, absolute: string) => {
  for (let dir = dirname(absolute); ; dir = dirname(dir)) {
    for (const name of STATIC_CONFIGS) {
      const text = await readFile(join(dir, name), 'utf8').catch(() => undefined);
      if (text === undefined) continue;
      const parsed: unknown = name.endsWith('.json') ? JSON.parse(text) : parseYaml(text);
      if (!parsed || typeof parsed !== 'object') return {};
      const config = { ...(parsed as Record<string, unknown>) };
      delete config.plugins;
      delete config.overrides;
      return config;
    }
    if (dir === root || dirname(dir) === dir) return {};
  }
};
