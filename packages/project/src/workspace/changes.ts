import { WorkspaceError } from './workspace.exception';
import type { ImportsEdit, Undo, WorkspaceIo } from './workspace.type';

interface Step {
  readonly undo: Undo;
  /** The file this step wrote, and the text it left there. */
  readonly written?: { readonly path: string; readonly text: string };
  /** An edit made elsewhere (`renameImports`), with its own check. */
  readonly edit?: { readonly path: string; readonly edit: ImportsEdit };
}

/** Records what an operation changed, to put it back in reverse order. */
export class Changes {
  private readonly _steps: Step[] = [];

  constructor(private readonly _io: WorkspaceIo) {}

  /** Writes a file, remembering what was there. */
  async write(path: string, text: string): Promise<void> {
    const before = this._io.exists(path) ? await this._io.read(path) : undefined;
    if (before === text) return;
    await this._io.write(path, text);
    this._steps.push({
      undo: async () => {
        if (before !== undefined) await this._io.write(path, before);
        else if (this._io.exists(path)) await this._io.remove(path);
      },
      written: { path, text },
    });
  }

  /** Rewrites a code file's imports of a package (`WorkspaceIo.renameImports`, else as text). */
  async renameImports(
    path: string,
    from: string,
    to: string,
    asText: (text: string) => string | undefined,
  ): Promise<void> {
    if (!this._io.renameImports) {
      const renamed = asText(await this._io.read(path));
      if (renamed !== undefined) await this.write(path, renamed);
      return;
    }
    const edit = await this._io.renameImports(path, from, to);
    if (edit) this._steps.push({ undo: () => edit.undo(), edit: { path, edit } });
  }

  /** Removes a file or folder (to the trash). */
  async remove(path: string): Promise<void> {
    if (!this._io.exists(path)) return;
    this._steps.push({ undo: await this._io.remove(path) });
  }

  /** Something new was made at `path` (a copy): undo removes it. */
  created(path: string): void {
    this._steps.push({
      undo: async () => {
        if (this._io.exists(path)) await this._io.remove(path);
      },
    });
  }

  /** Runs an operation; what it changed before failing is put back. */
  async run(operation: () => Promise<void>): Promise<Undo> {
    try {
      await operation();
    } catch (error) {
      await this._undo(false).catch(() => undefined);
      throw error;
    }
    return () => this._undo(true);
  }

  /**
   * Puts everything back, last change first. With `check`, nothing is undone when a file was
   * edited since the operation (its edit would be lost); the steps stay for another try. A step
   * that fails does not stop the others: the first failure is rethrown at the end.
   */
  private async _undo(check: boolean): Promise<void> {
    if (check) {
      const last = new Map<string, string>();
      for (const { written } of this._steps) if (written) last.set(written.path, written.text);
      const changed: string[] = [];
      for (const [path, text] of last) {
        if (!this._io.exists(path) || (await this._io.read(path)) !== text) changed.push(path);
      }
      for (const { edit } of this._steps) {
        if (edit && !(await edit.edit.isValid())) changed.push(edit.path);
      }
      if (changed.length)
        throw new WorkspaceError(
          `Not undone: ${changed.join(', ')} changed since. Undo those edits first, or change it back by hand.`,
        );
    }
    const failures: unknown[] = [];
    for (const step of this._steps.splice(0).reverse()) {
      try {
        await step.undo();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) throw failures[0];
  }
}
