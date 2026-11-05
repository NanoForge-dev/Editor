import { DocumentServiceToken } from '@nanoforge-dev/editor-code';
import {
  type Container,
  CoreServices,
  type Disposable,
  DisposableStore,
  type Logger,
  MutableDisposable,
  type Observable,
  ObservableValue,
  createToken,
  observe,
} from '@nanoforge-dev/editor-kernel';
import {
  type ClientProject,
  PROJECT_CHECKS,
  type ProjectService,
  type ProjectSuggestion,
} from '@nanoforge-dev/editor-project';
import { CoreSettings, type SettingsService } from '@nanoforge-dev/editor-settings';
import type { ChangesetPreviewService, NotificationService } from '@nanoforge-dev/editor-ui';
import { notifyError } from '@nanoforge-dev/editor-ui/notification';

import type { WorkspaceActions } from '../workspace/workspace-actions';

/** The report of the open project. */
export interface AdoptionReport {
  readonly checking: boolean;
  readonly suggestions: readonly ProjectSuggestion[];
}

/** Files changing this long ago are checked again. */
const RECHECK_MS = 1500;

/**
 * The Project screen's "Adapt to the editor" report: runs the checks of `PROJECT_CHECKS` when a
 * project opens and after its files change, hides dismissed suggestions, and previews a fix
 * before applying it as one step of the Project history. Nothing is changed without a click.
 */
export class AdoptionService implements Disposable {
  private readonly _report = new ObservableValue<AdoptionReport>({
    checking: false,
    suggestions: [],
  });
  private readonly _store = new DisposableStore();
  private readonly _project = this._store.add(new MutableDisposable<DisposableStore>());
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _run = 0;

  constructor(
    private readonly _options: {
      readonly services: Container;
      readonly projects: ProjectService;
      readonly settings: SettingsService;
      readonly workspace: WorkspaceActions;
      readonly previews: ChangesetPreviewService;
      readonly notifications: NotificationService;
      readonly logger: Logger;
    },
  ) {
    this._store.add(observe(_options.projects.current, (project) => this._follow(project)));
    /** A plugin that activates later brings its checks. */
    this._store.add(
      _options.services.get(CoreServices.Extensions).onDidChange((point) => {
        if (point.id === PROJECT_CHECKS.id) this._schedule();
      }),
    );
  }

  get report(): Observable<AdoptionReport> {
    return this._report.readonly();
  }

  /** Runs every check again. */
  async refresh(): Promise<void> {
    const project = this._options.projects.current.get();
    const run = ++this._run;
    if (!project) {
      this._report.set({ checking: false, suggestions: [] });
      return;
    }
    this._report.set({ ...this._report.get(), checking: true });
    const checks = this._options.services.get(CoreServices.Extensions).getValues(PROJECT_CHECKS);
    const results = await Promise.all(
      checks.map((check) =>
        check.run(project).catch((error: unknown) => {
          this._options.logger.warn(`The ${check.id} check failed`, error);
          return [] as ProjectSuggestion[];
        }),
      ),
    );
    if (run !== this._run) return;
    const dismissed = new Set(this._options.settings.get(CoreSettings.adoptionDismissed));
    this._report.set({
      checking: false,
      suggestions: results.flat().filter((suggestion) => !dismissed.has(suggestion.id)),
    });
  }

  /** Puts a suggestion away for this project. */
  async dismiss(suggestion: ProjectSuggestion): Promise<void> {
    const dismissed = this._options.settings.get(CoreSettings.adoptionDismissed);
    await this._options.settings.set(
      CoreSettings.adoptionDismissed,
      [...new Set([...dismissed, suggestion.id])],
      'projectLocal',
    );
    this._report.set({
      ...this._report.get(),
      suggestions: this._report.get().suggestions.filter((item) => item.id !== suggestion.id),
    });
  }

  /** Shows the fix's changes; applies them when the user agrees. True once applied. */
  async fix(suggestion: ProjectSuggestion): Promise<boolean> {
    const { fix } = suggestion;
    if (!fix) return false;
    const { notifications, previews, workspace } = this._options;
    try {
      const changeset = await fix.changeset();
      if (!changeset.files.length) {
        notifications.notify('info', `${fix.title}: nothing to change`);
        return false;
      }
      const dirty = new Set(this._options.services.tryGet(DocumentServiceToken)?.dirtyUris ?? []);
      const unsaved = changeset.files.filter((file) => dirty.has(file.path));
      if (unsaved.length) {
        notifications.notify('warning', `${fix.title}: save your changes first`, {
          detail: `${unsaved.map((file) => file.path).join(', ')} has unsaved changes.`,
        });
        return false;
      }
      const repository =
        this._options.services.get(CoreServices.ContextKeys).get('git.repository') === true;
      const apply = await previews.preview({
        ...changeset,
        notes: [
          ...(changeset.notes ?? []),
          ...(repository
            ? ['This project is a git repository: commit your work first, to compare afterwards.']
            : []),
        ],
      });
      if (!apply) return false;
      const applied = await workspace.applyChangeset(changeset);
      await this.refresh();
      return applied;
    } catch (error) {
      notifyError(notifications, `${fix.title}: not possible`, error);
      return false;
    }
  }

  dispose(): void {
    clearTimeout(this._timer);
    this._store.dispose();
  }

  private _schedule(): void {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => void this.refresh(), RECHECK_MS);
  }

  private _follow(project: ClientProject | undefined): void {
    clearTimeout(this._timer);
    if (!project) {
      this._project.clear();
      void this.refresh();
      return;
    }
    const store = new DisposableStore();
    store.add(project.fs.onDidChange(() => this._schedule()));
    this._project.value = store;
    void this.refresh();
  }
}

export const AdoptionServiceToken = createToken<AdoptionService>('editor.adoption');
