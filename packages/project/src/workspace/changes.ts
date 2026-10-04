import type { Undo, WorkspaceIo } from './workspace.type';

/** Records what an operation changed, to put it back in reverse order. */
export class Changes {
  private readonly _undo: Undo[] = [];

  constructor(private readonly _io: WorkspaceIo) {}

  /** Writes a file, remembering what was there. */
  async write(path: string, text: string): Promise<void> {
    const before = this._io.exists(path) ? await this._io.read(path) : undefined;
    if (before === text) return;
    await this._io.write(path, text);
    this._undo.push(async () => {
      if (before !== undefined) await this._io.write(path, before);
      else if (this._io.exists(path)) await this._io.remove(path);
    });
  }

  /** Removes a file or folder (to the trash). */
  async remove(path: string): Promise<void> {
    if (!this._io.exists(path)) return;
    this._undo.push(await this._io.remove(path));
  }

  /** Something new was made at `path` (a copy): undo removes it. */
  created(path: string): void {
    this._undo.push(async () => {
      if (this._io.exists(path)) await this._io.remove(path);
    });
  }

  /** Runs an operation; what it changed before failing is put back. */
  async run(operation: () => Promise<void>): Promise<Undo> {
    try {
      await operation();
    } catch (error) {
      await this.undo().catch(() => undefined);
      throw error;
    }
    return () => this.undo();
  }

  async undo(): Promise<void> {
    for (const undo of this._undo.splice(0).reverse()) await undo();
  }
}
