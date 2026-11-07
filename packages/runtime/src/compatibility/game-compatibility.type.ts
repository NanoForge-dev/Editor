/** How well a running game and the editor understand each other. */
export interface GameCompatibility {
  readonly source: 'client' | 'server';
  readonly app: string;
  /**
   * - `ok`: same protocol.
   * - `legacy`: the game never said `hello`: it does not register the editor library
   *   (`EditorLibrary` of `@nanoforge-dev/editor-lib`), or its engine predates the bridge.
   * - `older` / `newer`: the engine speaks an older / newer protocol than the editor.
   */
  readonly status: 'ok' | 'legacy' | 'older' | 'newer';
  readonly protocolVersion?: number;
  /** What it means and what to do, for the user (absent when `ok`). */
  readonly message?: string;
}
