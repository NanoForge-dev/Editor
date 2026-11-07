import type { Logger } from '@nanoforge-dev/editor-kernel';
import { MetaFile } from '@nanoforge-dev/editor-meta/pure';
import type { ClientProject } from '@nanoforge-dev/editor-project';

const EDITOR_GITIGNORE = '.nanoforge/editor/.gitignore';

/**
 * The meta cache files of `.nanoforge/editor/cache/meta/`: each is read from disk once, then
 * kept in memory. A file changed by edits is written once its source rests (`delayMs`), and only
 * when its text changed: typing would otherwise write a file at every pause.
 */
export class MetaCache {
  private readonly _files = new Map<string, MetaFile>();
  private readonly _pending = new Map<string, ReturnType<typeof setTimeout>>();
  /** The text last read or written of each file. */
  private readonly _written = new Map<string, string>();
  /** Files extracted in this session (their first write is not delayed). */
  private readonly _extracted = new Set<string>();
  /** Writes under way, for `flush`. */
  private readonly _writing = new Set<Promise<void>>();

  constructor(
    private readonly _fs: ClientProject['fs'],
    private readonly _delayMs = 2000,
    private readonly _logger?: Logger,
  ) {}

  async read(path: string): Promise<MetaFile | undefined> {
    const kept = this._files.get(path);
    if (kept) return kept;
    if (!this._fs.entry(path)) return undefined;
    try {
      const { text } = await this._fs.readText(path);
      const parsed = MetaFile.safeParse(JSON.parse(text));
      if (!parsed.success) return undefined;
      this._files.set(path, parsed.data);
      this._written.set(path, text);
      return parsed.data;
    } catch {
      return undefined;
    }
  }

  /**
   * Keeps a new meta file, and writes it once it stopped changing for a moment. The first one of
   * a file in a session (the cache was missing or out of date) is written at once: the next
   * start needs it, and the page may close before the delay.
   */
  set(path: string, file: MetaFile): void {
    const first = !this._extracted.has(path);
    this._extracted.add(path);
    this._files.set(path, file);
    clearTimeout(this._pending.get(path));
    if (first) {
      this._pending.delete(path);
      void this._write(path);
      return;
    }
    this._pending.set(
      path,
      setTimeout(() => {
        this._pending.delete(path);
        void this._write(path);
      }, this._delayMs),
    );
  }

  /** Writes the files still waiting, and waits for the writes under way. */
  async flush(): Promise<void> {
    const paths = [...this._pending.keys()];
    for (const path of paths) clearTimeout(this._pending.get(path));
    this._pending.clear();
    await Promise.all([...paths.map((path) => this._write(path)), ...this._writing]);
  }

  private _write(path: string): Promise<void> {
    const writing = this._doWrite(path).finally(() => this._writing.delete(writing));
    this._writing.add(writing);
    return writing;
  }

  private async _doWrite(path: string): Promise<void> {
    const file = this._files.get(path);
    if (!file) return;
    const text = `${JSON.stringify(file, null, 2)}\n`;
    if (this._written.get(path) === text) return;
    this._written.set(path, text);
    await this._ensureIgnored().catch(() => undefined);
    await this._fs.write(path, text).catch((error: unknown) => {
      this._written.delete(path);
      this._logger?.warn(`Could not cache ${path}`, error);
    });
  }

  /** The cache is never committed: `cache/` in `.nanoforge/editor/.gitignore`. */
  private async _ensureIgnored(): Promise<void> {
    const current = this._fs.entry(EDITOR_GITIGNORE)
      ? await this._fs.readText(EDITOR_GITIGNORE)
      : undefined;
    const lines = current?.text.split('\n').map((line) => line.trim()) ?? [];
    if (lines.includes('cache/')) return;
    const text = `${current?.text.trimEnd() ?? ''}${current?.text.trim() ? '\n' : ''}cache/\n`;
    await this._fs.write(EDITOR_GITIGNORE, text).catch(() => undefined);
  }
}
