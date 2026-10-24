# Code editor plugin (`@nanoforge/code-editor`)

Requirements session: 2026-09-26. Built-in plugin in `plugins/code-editor`, the first of phase 9.

## Goal

Edit a game's code in the editor like in an IDE: Monaco on a `Script` main screen, with the project's types, the engine's types and the diagnostics of the code worker.

## Decisions

| Topic       | Decision                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor core | **Monaco** (lazy-loaded with the plugin). Its TypeScript worker is fed the project files and the `.d.ts` of imported packages.                                                                                                                     |
| Files       | **All text files.** TS/JS get full language support; JSON, Markdown, CSS, YAML, `.env` and other text get syntax highlighting. Binary files go to other document editors.                                                                          |
| Layout      | **Tabs and split view**: up to two editor groups side by side on the `Script` screen, each with its own tabs.                                                                                                                                      |
| Saving      | **Explicit save** (`Ctrl+S`, save all), with dirty markers on tabs. Unsaved changes survive a reload: they are kept locally until saved or reverted.                                                                                               |
| Formatting  | **The project's Prettier**, with its config and plugins, run by the local editor server. Hosted editors never run project code: they use a bundled Prettier and the JSON/YAML config only (`.prettierrc`, `.prettierrc.json`, `.prettierrc.yaml`). |
| Navigation  | **Go to definition** across project files and into `@nanoforge-dev/*` declarations, which open read-only.                                                                                                                                          |
| Conflicts   | A file that changes on disk while it has unsaved edits shows a **"Changed on disk" banner** with _Compare_ (side-by-side diff), _Keep mine_ and _Load disk version_. Files without unsaved edits reload silently.                                  |

## Settings (IntelliJ-like)

| Key                                                                | Default             | Scopes           | Meaning                                                                                                     |
| ------------------------------------------------------------------ | ------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `codeEditor.autoSave.afterDelay`                                   | `false`             | all              | Save when no key was pressed for `autoSave.delayMs`.                                                        |
| `codeEditor.autoSave.delayMs`                                      | `1000`              | all              | Delay of the above.                                                                                         |
| `codeEditor.autoSave.onFocusLoss`                                  | `false`             | all              | Save when the editor loses focus, on tab switch or when the window is left (IntelliJ "frame deactivation"). |
| `codeEditor.onSave.format`                                         | `false`             | all              | Reformat with Prettier on save ("Actions on Save").                                                         |
| `codeEditor.onSave.organizeImports`                                | `false`             | all              | Organize imports of TS/JS files on save.                                                                    |
| `runtime.saveBeforePlay`                                           | `true`              | all              | Play saves every open document first.                                                                       |
| `codeEditor.fontSize`, `codeEditor.minimap`, `codeEditor.wordWrap` | 13, `true`, `false` | account, machine | Display.                                                                                                    |

Autosave and the actions on save apply to every save path (explicit, delayed, focus loss, before Play).

## Extension points

- `codeEditor.sidePanels` (added in phase 10, for the ECS plugin's _Component_ panel): `{ id, title, icon, when, component }`. A collapsible panel beside the editor group, toggled from the editor's toolbar, shown when `when` matches the active file (context key `codeEditor.activeFile`).

## Commands and shortcuts

- `codeEditor.open(path, { line?, column?, group? })`: opens a file in a tab. This is also the command of the plugin's `documentEditors` contribution, so `documents.open` in the core (double click in Files) reaches it.
- `codeEditor.save` (`Mod+S`), `codeEditor.saveAll` (`Mod+K S`; `Mod+Alt+S` opens Settings, like IntelliJ), `codeEditor.revert`.
- `codeEditor.format` (`Shift+Alt+F`), `codeEditor.organizeImports` (`Shift+Alt+O`).
- `codeEditor.splitRight` (`Mod+\`), `codeEditor.closeTab` (`Alt+W`: browsers keep `Ctrl+W` for themselves; middle click also closes a tab).
- Undo and redo stay Monaco's own while the editor is focused (phase 4 decision). Edits made by other plugins through `DocumentService` go to the open Monaco model.

## Integration with the core

- Each Monaco model is registered as an `OpenDocument` in `DocumentService`: dirty state, save (optimistic concurrency with the file hash), revert.
- Diagnostics: TS diagnostics come from the code worker (`DiagnosticsService`) and are shown as Monaco markers. Monaco's own TypeScript diagnostics are turned off (the code worker's include syntax errors), so there is a single TypeScript checking the project. Monaco's TypeScript still provides completions, hovers, go to definition and rename, from the project files and the imported packages' declarations (`exports` resolved like the game's build).
- Core additions:
  - `documents.open(path)` command, which picks the best `documentEditors` entry and runs its `command`;
  - a `documentEditors` manifest contribution (declared statically, so opening a file activates the plugin);
  - `DocumentService.saveAll`;
  - a `code.format` RPC.
- Files panel: double click opens the file through `documents.open`, replacing the temporary `code.check`.

## Out of scope (later)

- Debugger and breakpoints (needs the runtime inspector work, phase 11).
- Git gutter and blame (git plugin, 11.4).
- Refactorings beyond rename and organize imports; snippets.
- Real-time collaboration (the `DocumentBackend` seam stays ready for it).

## Done when

- Browser tests:
  - open a file;
  - edit, see the dirty marker, save (the file changes on disk);
  - reload with unsaved edits and get them back;
  - go to definition into `@nanoforge-dev/core`;
  - see a TS error as a marker.
- Format uses the project's Prettier config in pong-network.
- A disk change during an unsaved edit shows the banner, and _Compare_ opens a diff.
- Autosave and actions-on-save settings work as described.
