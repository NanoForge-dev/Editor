import { type Observable, ObservableValue, createToken } from '@nanoforge-dev/editor-kernel';

/** What a change would do to the project's files (`Changeset` of the project package). */
export interface ChangesetPreview {
  readonly title: string;
  /** No `before`: created; no `after`: removed. */
  readonly files: readonly {
    readonly path: string;
    readonly before?: string;
    readonly after?: string;
  }[];
  readonly notes?: readonly string[];
  /** The button that makes the change (`Apply`). */
  readonly confirm?: string;
}

export interface PendingPreview extends ChangesetPreview {
  readonly resolve: (apply: boolean) => void;
}

/** Shows a change as a diff of its files, to apply or cancel (project adoption's codemods). */
export class ChangesetPreviewService {
  private readonly _current = new ObservableValue<PendingPreview | undefined>(undefined);

  get current(): Observable<PendingPreview | undefined> {
    return this._current.readonly();
  }

  /** Resolves with true when the user applies it. */
  preview(changeset: ChangesetPreview): Promise<boolean> {
    this._current.get()?.resolve(false);
    return new Promise((resolve) => {
      this._current.set({
        ...changeset,
        resolve: (apply) => {
          this._current.set(undefined);
          resolve(apply);
        },
      });
    });
  }
}

export const ChangesetPreviewServiceToken =
  createToken<ChangesetPreviewService>('ui.changesetPreview');
