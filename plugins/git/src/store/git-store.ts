import {
  type Disposable,
  type GitBranch,
  type GitCommit,
  type GitStash,
  type GitStatus,
  ObservableValue,
} from '@nanoforge-dev/editor-sdk';

/** The git API of one project (the RPC contract with the project bound). */
export interface GitApi {
  status(): Promise<GitStatus>;
  branches(): Promise<GitBranch[]>;
  stashes(): Promise<GitStash[]>;
  /** The history of a branch (the current one when undefined). */
  log(limit: number, branch: string | undefined): Promise<GitCommit[]>;
}

export interface GitState {
  /** Undefined until the first answer. */
  readonly status: GitStatus | undefined;
  readonly branches: readonly GitBranch[];
  readonly stashes: readonly GitStash[];
  readonly log: readonly GitCommit[];
  /** Branch whose history is listed; undefined: the current one. */
  readonly logBranch: string | undefined;
  /** Commits asked for (_Show more_ raises it). */
  readonly logLimit: number;
  /** Whether the history may hold more commits than shown. */
  readonly more: boolean;
  /** An operation is running. */
  readonly busy: boolean;
  /** A read of the repository has been running for a while (a quick one does not show). */
  readonly reading: boolean;
  /** Why git can't be used here (a hosted editor), if so. */
  readonly unavailable: string | undefined;
  /** Why the last read of the repository failed (git missing, a broken `.git`…), if it did. */
  readonly readError: string | undefined;
}

const EMPTY: GitState = {
  status: undefined,
  branches: [],
  stashes: [],
  log: [],
  logBranch: undefined,
  logLimit: 50,
  more: false,
  busy: false,
  reading: false,
  unavailable: undefined,
  readError: undefined,
};

const PAGE = 50;
/** A read shows as running only once it took this long. */
const READING_MS = 250;

/**
 * What the Git panel, the status bar and the Files marks show: the repository state of the open
 * project, refreshed after each operation and when files change (debounced).
 */
export class GitStore implements Disposable {
  private readonly _state = new ObservableValue<GitState>(EMPTY);
  private _api: GitApi | undefined;
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _generation = 0;
  private _refreshing: Promise<void> | undefined;
  private _queued: Promise<void> | undefined;

  readonly state = this._state.readonly();

  constructor(
    private readonly _onError: (title: string, error: unknown) => void = () => undefined,
    private readonly _delayMs = 400,
  ) {}

  /** Follows a project's repository (undefined: no project). */
  setApi(api: GitApi | undefined): void {
    this._api = api;
    this._generation++;
    clearTimeout(this._timer);
    this._state.set(EMPTY);
    if (api) void this.refresh();
  }

  /** Refreshes soon: for bursts of file changes. */
  schedule(): void {
    if (!this._api || this._state.get().unavailable) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => void this.refresh(), this._delayMs);
  }

  /**
   * Reads the repository again. A call made while a read runs gets one more read after it
   * (shared by every such call), so its answer is never older than the call.
   */
  refresh(): Promise<void> {
    if (!this._refreshing) {
      const shown = setTimeout(() => this._patch({ reading: true }), READING_MS);
      this._refreshing = this._read().finally(() => {
        clearTimeout(shown);
        this._refreshing = undefined;
        if (this._state.get().reading) this._patch({ reading: false });
      });
      return this._refreshing;
    }
    this._queued ??= this._refreshing.then(() => {
      this._queued = undefined;
      return this.refresh();
    });
    return this._queued;
  }

  /** Runs an operation, then refreshes. Resolves false when it failed (the error is reported). */
  async run(title: string, operation: () => Promise<unknown>): Promise<boolean> {
    this._patch({ busy: true });
    try {
      await operation();
      return true;
    } catch (error) {
      this._onError(title, error);
      return false;
    } finally {
      this._patch({ busy: false });
      await this.refresh();
    }
  }

  /** Lists the history of a branch (undefined: the current one). */
  showBranch(branch: string | undefined): Promise<void> {
    this._patch({ logBranch: branch, logLimit: PAGE });
    return this.refresh();
  }

  showMore(): Promise<void> {
    this._patch({ logLimit: this._state.get().logLimit + PAGE });
    return this.refresh();
  }

  dispose(): void {
    clearTimeout(this._timer);
    this._api = undefined;
    this._generation++;
  }

  private async _read(): Promise<void> {
    const api = this._api;
    const generation = this._generation;
    if (!api) return;
    try {
      const status = await api.status();
      const limit = this._state.get().logLimit;
      const branches = status.repository ? await api.branches() : [];
      const wanted = this._state.get().logBranch;
      const logBranch =
        wanted !== status.branch && branches.some((branch) => branch.name === wanted)
          ? wanted
          : undefined;
      const [stashes, log] = status.repository
        ? await Promise.all([api.stashes(), api.log(limit, logBranch)])
        : [[], []];
      if (generation !== this._generation) return;
      this._patch({
        status,
        branches,
        stashes,
        log,
        logBranch,
        more: log.length >= limit,
        unavailable: undefined,
        readError: undefined,
      });
    } catch (error) {
      if (generation !== this._generation) return;
      if ((error as { code?: string }).code === 'FORBIDDEN') {
        this._patch({ ...EMPTY, unavailable: 'Git is available in local editors only.' });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const repeated = this._state.get().readError === message;
      this._patch({ readError: message });
      if (!repeated) this._onError('Could not read the repository', error);
    }
  }

  private _patch(patch: Partial<GitState>): void {
    this._state.set({ ...this._state.get(), ...patch });
  }
}
