import { type Observable, ObservableValue, createToken } from '@nanoforge-dev/editor-kernel';

import type { CodeDiagnostic } from '../engine/engine.type';

/** Problems per file and source (TypeScript, analyzers, build…), for the Problems panel. */
export class DiagnosticsService {
  private readonly _all = new ObservableValue<ReadonlyMap<string, readonly CodeDiagnostic[]>>(
    new Map(),
  );
  private readonly _bySource = new Map<string, Map<string, readonly CodeDiagnostic[]>>();

  /** Every problem, by file. */
  get all(): Observable<ReadonlyMap<string, readonly CodeDiagnostic[]>> {
    return this._all.readonly();
  }

  forUri(uri: string): readonly CodeDiagnostic[] {
    return this._all.get().get(uri) ?? [];
  }

  /** Replaces the problems of a source for this file. */
  set(source: string, uri: string, diagnostics: readonly CodeDiagnostic[]): void {
    this.setMany(source, new Map([[uri, diagnostics]]));
  }

  /**
   * Replaces the problems of a source for these files, at once: `all` changes once, and not at
   * all when every file's problems are the same as before.
   */
  setMany(source: string, byUri: ReadonlyMap<string, readonly CodeDiagnostic[]>): void {
    const files = this._bySource.get(source) ?? new Map<string, readonly CodeDiagnostic[]>();
    this._bySource.set(source, files);
    let changed = false;
    for (const [uri, diagnostics] of byUri) {
      const before = files.get(uri) ?? [];
      if (JSON.stringify(before) === JSON.stringify(diagnostics)) continue;
      changed = true;
      if (diagnostics.length) files.set(uri, diagnostics);
      else files.delete(uri);
    }
    if (changed) this._recompute();
  }

  /** Files a source reported problems for. */
  uris(source: string): string[] {
    return [...(this._bySource.get(source)?.keys() ?? [])];
  }

  clear(source: string, uri?: string): void {
    const files = this._bySource.get(source);
    if (!files) return;
    if (uri) files.delete(uri);
    else files.clear();
    this._recompute();
  }

  private _recompute(): void {
    const merged = new Map<string, CodeDiagnostic[]>();
    for (const files of this._bySource.values()) {
      for (const [uri, list] of files) merged.set(uri, [...(merged.get(uri) ?? []), ...list]);
    }
    for (const list of merged.values()) {
      list.sort(
        (a, b) =>
          (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0) || a.start - b.start,
      );
    }
    this._all.set(merged);
  }
}

export const DiagnosticsServiceToken = createToken<DiagnosticsService>('code.diagnostics');
