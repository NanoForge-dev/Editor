# Console plugin (`@nanoforge/console`)

Requirements session: 2026-10-01. Built-in plugin in `plugins/console`, the first of phase 11. It replaces the core's temporary Output panel.

One plugin, two widgets: **Console** and **Problems**. Both open as tabs of the bottom dock, and each can be moved or closed on its own.

## Console

### Sources

Every line has a source, and every source belongs to a group:

| Group   | Sources                                                         | Shown by default |
| ------- | --------------------------------------------------------------- | ---------------- |
| Game    | the running client, the running server                          | yes              |
| Build   | one per app (`nf build --editor` output and its errors)         | yes              |
| Tasks   | commands the editor server runs in the project (`nf …`)         | yes              |
| Editor  | the editor's own loggers (`runtime`, `code`, `kernel.plugins`…) | no               |
| Plugins | one per plugin, named after it                                  | no               |

A hidden group that holds warnings or errors shows a dot on its chip (the tooltip gives the count), so a problem in the editor or a plugin is never invisible.

### Filters

- **Group chips** (Game, Build, Tasks, Editor, Plugins): click to show or hide a group. Each chip shows its line count.
- **Sources menu**: show or hide a single source inside a group (only the server, only one plugin…).
- **Levels**: Debug, Info, Warnings, Errors. Debug is off by default.
- **Search**: text, case-insensitive, matches the message and the source name.
- Filters are kept with the widget (they survive a reload).

### Lines

- Time, source, message. Warnings and errors are colored.
- **Repeats are grouped**: identical consecutive lines (same source, level and text) show once with a count.
- **Expandable values**: logged objects, arrays, maps, sets and errors show as a one-line preview that expands into a tree. Values are snapshots taken when logged, limited in depth and size (the tree says what was cut).
  - Editor and plugin logs: the logger's arguments.
  - Game client: the arguments of `console.*` calls, serialized by the engine.
  - Game server and build output: plain text (they come from the process output).
- **File links**:
  - project paths in the text (`apps/client/src/main.ts:12:3`, absolute paths inside the project, TypeScript's `file.ts(12,3)`) open the file at that position;
  - stack frames in a built game bundle are mapped back to the source file through the bundle's source map, and link to it;
  - game client lines show **where they were logged** (`main.ts:12`) on the right, linking to that line;
  - a frame that can't be mapped (no source map, an engine or library file outside the project) stays plain text.
- The view follows new lines unless you scrolled up; a _Jump to latest_ button brings it back.

### Actions

- **Clear** the console.
- **Copy** a line, or every shown line (context menu): time, source and the one-line text.
- The console keeps the last `@nanoforge/console.maxLines` lines (default 2000).

There is no "clear on play": lines stay until cleared.

## Problems

- Lists everything in `DiagnosticsService`: TypeScript, plugin analyzers (ECS…), and build errors.
- **Grouped by file**, collapsible, each file with its error and warning counts. Problems without a file (a failed build with no location) are grouped under their source.
- A row shows the severity, the message, the source and code (`typescript 2322`) and `line:column`. Clicking opens the file at that position.
- Filters: errors, warnings, infos, and a text search over messages and paths.
- **Whole-project check**: with `@nanoforge/console.checkWholeProject` (default on), every code file of the project is checked, not only the open ones. It runs in the code worker when the project opens and again after files change. With it off, only open files and files checked by hand are listed.
- **Build errors** of `nf build --editor` are listed with their file and position, per app, and leave when that app builds again without them.
- **Status bar**: error and warning counts (`2 errors · 1 warning`, or `No problems`); clicking opens Problems.

## Core additions

- **Logger** (`kernel`):
  - `LogEntry.values` (arguments already serialized, from a game) and `LogEntry.location` (where it was logged);
  - `LoggerService.write(entry)`;
  - the `LogValue` tree, `serializeLogValue` (depth, size and cycle limits), `formatLogValue`. The engine bridge writes the same format;
  - the editor's logger keeps Debug entries (the browser console still gets Info and above).
- **Runtime**:
  - `RuntimeLog` gains `values`, `location`, the `debug` level and the `cli` source;
  - build output lines are forwarded (only parsed errors were);
  - `RuntimeService.sourceLocation(file, line, column)` maps a position in a built bundle to a project file through its source map (`@jridgewell/trace-mapping`), cached per build.
- **Server**: CLI runs inside an open project, other than builds, are streamed as `cli` log events (the command line first, then its output).
- **Diagnostics** (`code`): `CodeDiagnostic.line`/`column` (1-based), filled for TypeScript problems and build errors; build errors go into `DiagnosticsService` as source `build:<app>`; `CodeService.checkProject()` keeps every code file checked until disposed.
- **SDK**: exports for the above.
- The core Output panel (`core.output`) is removed.

## Other repositories (unpushed worktrees)

- **Engine** (`../engine-editor-bridge`): the `logs` feature accepts `{ values: true }`. Log events then carry `values` (serialized arguments) and `caller` (the first frame of the game bundle). The text message is always sent, so an older editor still works, and an older engine still sends text to this editor.
- **CLI** (`../cli-editor`): `nf build --editor` writes linked source maps. With a CLI that doesn't, bundle frames stay plain text.
  - `nf` runs the CLI installed in the project (`node_modules/@nanoforge-dev/cli`), so a project gets source maps once its own CLI is updated.
  - E2E: `NANOFORGE_CLI=<cli checkout>` links that CLI into the played game; without it the "where it was logged" check is skipped.

## Done when

- Unit tests: value serialization (limits, cycles, errors), link detection, source-map lookup, repeat grouping, build output to diagnostics, whole-project check.
- Browser tests:
  - editor and plugin lines appear under their groups, and the chips, level and search filters narrow them;
  - identical lines are grouped with a count;
  - a logged object expands;
  - a path in a line opens the file at that line;
  - Problems lists a TypeScript error of a file that is not open, grouped by file, and clicking opens it at the position;
  - the status bar counts follow, and open Problems;
  - (with the engine) game output appears under Game, and a logged object expands.
