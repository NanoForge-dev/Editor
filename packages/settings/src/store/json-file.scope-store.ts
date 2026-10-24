import { DisposableStore, type Observable, ObservableValue } from '@nanoforge-dev/editor-kernel';

import type { ScopeStore, SettingValues, TextFileAdapter } from './scope-store.type';
import { applyPatch, serializeValues } from './setting-values';
import { SettingsFileError } from './settings-file.exception';

const isConflict = (error: unknown) => (error as { code?: string } | null)?.code === 'CONFLICT';

/**
 * Scope stored as a JSON object in a file. Edits made outside the editor are picked up; a
 * file that is not valid JSON is never overwritten (writes fail until it is fixed).
 */
export class JsonFileScopeStore implements ScopeStore {
  private readonly _values = new ObservableValue<SettingValues>({});
  private readonly _store = new DisposableStore();
  private _hash: string | null = null;
  private _invalid: string | undefined;
  private _queue: Promise<void> = Promise.resolve();

  constructor(private readonly _file: TextFileAdapter) {}

  get values(): Observable<SettingValues> {
    return this._values.readonly();
  }

  /** Parse error of the file, when it is not a JSON object. */
  get invalid(): string | undefined {
    return this._invalid;
  }

  async initialize(): Promise<void> {
    this._store.add(this._file.onDidChange(() => void this._reload()));
    await this._reload();
  }

  write(patch: SettingValues): Promise<void> {
    const task = this._queue.then(() => this._write(patch));
    this._queue = task.catch(() => undefined);
    return task;
  }

  dispose(): void {
    this._store.dispose();
  }

  private async _write(patch: SettingValues, attempt = 0): Promise<void> {
    if (this._invalid) throw new SettingsFileError(`Settings file is invalid: ${this._invalid}`);
    const next = applyPatch(this._values.get(), patch);
    try {
      const { hash } = await this._file.write(serializeValues(next), this._hash);
      this._hash = hash;
      this._values.set(next);
    } catch (error) {
      if (!isConflict(error) || attempt >= 3) throw error;
      await this._reload(true);
      await this._write(patch, attempt + 1);
    }
  }

  private async _reload(fresh = false): Promise<void> {
    const file = await this._file.read(fresh);
    if (file?.hash === this._hash && this._hash !== null) return;
    this._hash = file?.hash ?? null;
    if (!file) {
      this._invalid = undefined;
      this._values.set({});
      return;
    }
    try {
      const parsed: unknown = JSON.parse(file.text || '{}');
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('expected a JSON object');
      }
      this._invalid = undefined;
      this._values.set(parsed as SettingValues);
    } catch (error) {
      this._invalid = error instanceof Error ? error.message : String(error);
      this._values.set({});
    }
  }
}
