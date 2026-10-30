import type { ClientProject } from '../service/client-project';
import type { Changeset } from '../workspace/changeset';

/**
 * Something the editor can't edit well in a project, and how to adapt it (the Project screen's
 * "Adapt to the editor" report). Never applied by itself: a fix is previewed, then applied.
 */
export interface ProjectSuggestion {
  /** Stable for the same finding (a dismissed one stays dismissed): `<check>:<what>`. */
  readonly id: string;
  readonly title: string;
  /** What the editor can't do as it is, and why the change helps. */
  readonly detail: string;
  /** The app or shared library it is about (its name). */
  readonly app?: string;
  /** A change of files, previewed as a diff before it is applied as one undo step. */
  readonly fix?: {
    readonly title: string;
    changeset(): Promise<Changeset>;
  };
  /** Something else to do (install the dependencies, open a page…). */
  readonly action?: {
    readonly title: string;
    run(): unknown;
  };
}

/** A check of the open project, contributed by core or a plugin (`PROJECT_CHECKS`). */
export interface ProjectCheck {
  readonly id: string;
  run(project: ClientProject): Promise<readonly ProjectSuggestion[]>;
}
