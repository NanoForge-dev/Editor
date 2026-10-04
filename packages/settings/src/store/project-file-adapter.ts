import { Events } from '@nanoforge-dev/editor-kernel';
import type { ProjectFs } from '@nanoforge-dev/editor-project';
import { RpcError } from '@nanoforge-dev/editor-rpc';

import type { TextFileAdapter } from './scope-store.type';

export const PROJECT_SETTINGS_FILE = '.nanoforge/editor/settings.json';
export const PROJECT_LOCAL_SETTINGS_FILE = '.nanoforge/editor/local.json';
const EDITOR_GITIGNORE = '.nanoforge/editor/.gitignore';

/** A file of the open project as a settings file. */
export const projectFileAdapter = (
  fs: ProjectFs,
  path: string,
  options: { gitignored?: boolean } = {},
): TextFileAdapter => ({
  async read(fresh = false) {
    if (!fresh && !fs.entry(path)) return undefined;
    try {
      const { text, hash } = await fs.readText(path, { fresh });
      return { text, hash };
    } catch (error) {
      if (RpcError.is(error, 'NOT_FOUND')) return undefined;
      throw error;
    }
  },
  async write(text, expectedHash) {
    if (options.gitignored) await ensureIgnored(fs, path);
    return fs.write(path, text, { expectedHash });
  },
  onDidChange: Events.map(
    Events.filter(fs.onDidChange, (changes) => changes.some((change) => change.path === path)),
    () => undefined,
  ),
});

/** Adds the file to `.nanoforge/editor/.gitignore` (never committed). */
const ensureIgnored = async (fs: ProjectFs, path: string) => {
  const name = path.split('/').at(-1)!;
  const current = fs.entry(EDITOR_GITIGNORE) ? await fs.readText(EDITOR_GITIGNORE) : undefined;
  const lines = current?.text.split('\n').map((line) => line.trim()) ?? [];
  if (lines.includes(name)) return;
  const text = `${current?.text.trimEnd() ?? ''}${current?.text.trim() ? '\n' : ''}${name}\n`;
  await fs.write(EDITOR_GITIGNORE, text, { expectedHash: current?.hash ?? null });
};
