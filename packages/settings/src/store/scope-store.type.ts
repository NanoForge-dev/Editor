import type { Disposable, Event, Observable } from '@nanoforge-dev/editor-kernel';

export type SettingValues = Readonly<Record<string, unknown>>;

/** Values of one scope. Keys unknown to the registry are preserved untouched. */
export interface ScopeStore extends Disposable {
  readonly values: Observable<SettingValues>;
  /** Loads initial values (called once before use). */
  initialize(): Promise<void>;
  /** Applies a patch; an `undefined` value removes the key. */
  write(patch: SettingValues): Promise<void>;
}

/** A text file with optimistic concurrency (implemented over `ProjectFs`). */
export interface TextFileAdapter {
  readonly onDidChange: Event<void>;
  /**
   * `fresh`: what is on disk now, not a cached copy (after a write conflict, the cache may
   * not know yet that the file changed).
   */
  read(fresh?: boolean): Promise<{ text: string; hash: string } | undefined>;
  /** `expectedHash: null` means the file must not exist; throws `{ code: 'CONFLICT' }` otherwise. */
  write(text: string, expectedHash: string | null): Promise<{ hash: string }>;
}
