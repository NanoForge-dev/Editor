# NanoForge Editor — Rewrite Plan

## Context

The current editor (`/editor`) is a single SvelteKit app. Its ECS features are hard-wired, it keeps state in module-level svelte stores, and it saves to `.nanoforge/*.save.json` through SvelteKit form actions. It no longer matches the rest of the ecosystem:

- The **engine** was restructured. A game is now a workspace (`nanoforge.config.ts` `type: workspace`) containing `apps/client` and `apps/server` (types `client`/`server`, plus `lib` for shared code). `core-editor` is gone, replaced by a minimal `@nanoforge-dev/editor-lib` bridge (`RunOptions.editor = { toEditor, fromEditor }`).
- The **CLI** removed `generate`, so there is no save→code step any more. The **editor must generate code directly**.
- The **loader** has no editor hooks.

The goal is a from-scratch editor with a real engine-editor architecture:

- a plugin kernel (plugins are nanoforge-style packages that consume and extend a core);
- a Godot-style customizable layout;
- IntelliJ-like layered settings (local / project / account, online + offline);
- per-context undo/redo;
- default widgets that plugins can extend or replace (code editor, file manager, viewport with Game and Scene modes);
- client/server-aware editing and running;
- a set of built-in plugins.

No code from the current repo is kept. Only its tooling conventions carry over (pnpm, ESLint/Prettier configs, commitlint, cliff-jumper, Docker, CI).

### Decisions taken with the user

| Topic               | Decision                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime             | Web app plus a local Bun server (SvelteKit, Svelte 5), keeping OFFLINE/ONLINE modes and the `nf editor` launch. Restructured as a pnpm monorepo.                                                                                   |
| Plugin isolation    | Same JS realm, trusted, dynamically imported ES modules.                                                                                                                                                                           |
| Plugin format       | Registry manifest `nanoforge.manifest.json` with `type: "plugin"`, the format future nanoforge packages will use. Plugins can require engine libs (`engineLibs`) and are activated per app.                                        |
| Plugin distribution | Built-in (bundled), user-installed (marketplace), local dev folders with hot reload.                                                                                                                                               |
| Layout              | Godot style: switchable **main screens** in the center, **dock slots** around them, floating docks.                                                                                                                                |
| Settings online     | Extend `api.nanoforge.eu` with a settings-sync API. IndexedDB offline cache.                                                                                                                                                       |
| History             | Per-context stacks, transactional and mergeable commands, configurable limit. Monaco keeps its native text undo.                                                                                                                   |
| Codegen             | **AST round-trip** (ts-morph). Only recognised nodes are edited; unknown code is preserved and shown as "code-only".                                                                                                               |
| No scene lib        | The Scene view edits the app's **entry file (`main.ts`) directly**, through the ECS plugin's default codegen target. Core only defines the extension point. A scene plugin overrides both the codegen target and the scene widget. |
| Server              | Edit server-side ECS (client/server/lib context) and run/debug the server locally.                                                                                                                                                 |
| Game viewer         | **Same-page import** of the built `main.js` (like today), with the editor-lib bridge.                                                                                                                                              |
| Cross-repo          | The plan includes changes to engine `editor-lib`, `loader` and `cli`.                                                                                                                                                              |
| Plugins             | Each built-in plugin gets **its own requirements session with the user before it is implemented**. This plan only fixes their place in the architecture.                                                                           |

---

## Target architecture

### Monorepo layout (pnpm workspaces + turbo, same as the engine repo)

```
apps/
  editor/                 SvelteKit shell + Bun server (routes, RPC endpoint, plugin host bootstrap)
packages/
  kernel/                 DI, disposables, events, extension points, commands, context keys, plugin manager (framework-agnostic, no Svelte)
  sdk/                    Public plugin API: definePlugin, tokens, types, re-exports. The ONLY package plugins import.
  rpc/                    Typed client↔server RPC (HTTP) + WS channels (fs watch, logs, runtime events)
  history/                Command/transaction engine, per-context stacks
  settings/               Layered settings engine + storage adapters + schema registry
  layout/                 Layout model (main screens, dock slots, floats), serialization, ops (no UI)
  ui/                     Svelte UI kit, theme tokens, style injection, layout renderer, widget host
  project/                Workspace/app discovery, project FS service (client cache + server), watcher
  code/                   Code service: TS/ts-morph in a Web Worker, transformer API, item extraction (ADR 0003)
  runtime/                Build/watch orchestration, same-page client runner, server process manager, logs
  server-core/            Server-side services (sessions/auth, fs, git, cli wrapper, api client, plugin server-entries)
plugins/                  Built-in plugins, each a standalone package with nanoforge.manifest.json (type "plugin")
  code-editor/  file-manager/  viewport/  ecs/  console/  command-palette/  inspectors/  git/  marketplace/  history-panel/  settings-ui/
tooling/                  shared tsconfig, vite plugin for building plugins (svelte externals, manifest emit)
```

Dependency rule: `kernel` ← everything else. `sdk` re-exports the public surface of kernel/history/settings/layout/ui/project/code/runtime. Plugins depend only on `sdk` (checked with an ESLint `no-restricted-imports` rule).

### 1. Plugin system (`kernel` + `sdk`)

- **Package format (decided: registry manifest)**: each plugin is a package with a `nanoforge.manifest.json` of `type: "plugin"`, the same format future nanoforge packages will use. It is published and installed through `nf publish` and the marketplace pipeline. The kernel validates it with zod. Shape:
  ```jsonc
  { "type": "plugin", "name": "@nanoforge/ecs", "version", "displayName", "description", "tags",
    "engines": { "editor": "^1.0.0" },
    "dependencies": { "@nanoforge/viewport": "^1.0.0" }, "optionalDependencies": {...},
    "engineLibs": { "required": { "@nanoforge-dev/ecs": "^2.0.0" }, "optional": { "@nanoforge-dev/graphics-2d": "^1.0.0" } },
    entry: { client: "src/index.ts", server?: "src/server.ts", worker?: "src/code.worker.ts" },
    activation: ["onStartup" | "onScreen:scene" | "onCommand:x" | "onProjectType:client"],
    contributes: { screens, docks/widgets, commands, keybindings, menus, settings, themes, viewportModes, codegenTargets, ... } }
  ```
- **Engine lib requirements** (`engineLibs`): a plugin can require an engine library (e.g. ECS plugin → `@nanoforge-dev/ecs`; a 2D gizmo plugin → `@nanoforge-dev/graphics-2d`).
  - The project service reports, **per app** (client/server/lib), which engine libs are installed (from the app's `package.json` plus the `libs` config), with their versions.
  - A plugin is activated **per app context**. If a required lib is missing or its version doesn't match, the plugin stays inactive for that app, its widgets show "requires X", and it offers a quick-fix command: "Install X in apps/client" (through the `nf install -l` wrapper). Afterwards it activates without a reload.
  - Optional libs set context keys (`engineLib:@nanoforge-dev/graphics-2d`) that plugins use in `when` clauses to light up extra features.
  - The ECS plugin requires `@nanoforge-dev/ecs`. So with no ECS lib, the Scene screen falls back to the empty state.
    The build (`tooling/vite-plugin`, `@nanoforge-dev/editor-vite-plugin`) validates `nanoforge.manifest.json` and emits it next to the ESM bundles. The marketplace can read it without executing code.
  - **Shared runtime (decided, [ADR 0001](adr/0001-plugin-ui-runtime.md)):** `svelte/*` and `@nanoforge-dev/editor-sdk` are externalized, and at build time their imports are rewritten to lookups in the host's `SharedModuleRegistry` (`globalThis.__nanoforge_editor_shared__`). That gives one Svelte runtime and one SDK instance, in dev and prod, with no import map. Plugins must use runes mode, and the host checks the Svelte version they were compiled with.
- **Kernel primitives**:
  - `Disposable` / `DisposableStore`: every registration returns one, so plugins unload cleanly.
  - Typed `ServiceToken<T>` plus DI container with scopes: app → project → plugin.
  - `provide(token, impl, { priority })` / `override(token, decorate)`: this is how a plugin **extends the core**. Example: the scene plugin overrides `CodegenTarget`.
  - `defineExtensionPoint<T>(id, schema)` and `contribute(point, value)`: plugins **create objects other plugins use**. Plugins can declare their own extension points; the ECS plugin exposes `ecs.inspectors.fieldEditors`.
  - Typed event bus; `CommandRegistry` (id, handler, `when` clause); `ContextKeyService` (focus, screen, selection…) for `when` clauses.
  - `LocalizationService`: per-plugin message bundles and a `locale` setting (en/fr built in).
- **Plugin manager**:
  - Discovery from three sources: bundled, installed (`~/.nanoforge/editor/plugins` offline, account list online), local-dev paths.
  - Semver dependency resolution, topological activation, lazy activation events, enable/disable per scope (enable state is a setting).
  - `activate(ctx)` / `deactivate()` with a `PluginContext` giving scoped access to services and a logger.
  - Error isolation: activation errors are caught and reported, dependents are disabled.
  - Local dev plugins hot-reload on rebuild: dispose, re-import with a cache-busting URL, re-activate.
- **Server entries**: an optional `entry.server` runs inside the Bun server, trusted, and registers namespaced RPC handlers. Git, runtime and marketplace need this.

### 2. UI, theming and widget style injection (`ui`)

- Theme = a set of CSS custom properties (`--nf-color-*`, `--nf-space-*`, `--nf-radius-*`, fonts) contributed through the `themes` extension point and selected in settings. Light and dark themes ship built in.
- Widgets are declared as `{ id, title, icon, component | mount(el, ctx), styles?, defaultSlot, singleton, when }`.
- Each widget's `styles` are injected once per plugin into `@layer plugin.<id>`, scoped under `[data-nf-widget="<id>"]`, and removed when the plugin is disposed. Everything uses theme variables, so re-theming is free.
- Base component kit on bits-ui, styled by tokens: buttons, trees, property grid, tabs, menus, splitters (paneforge), virtual lists, toasts.

### 3. Layout — Godot-style (`layout` model + `ui` renderer)

- **Main screens** sit in the center and switch from the top bar: `Scene`, `Script`, `Game`, plus any contributed by plugins. Each is a widget contribution with `kind: "screen"`.
- **Dock slots**: left-top, left-bottom, right-top, right-bottom, bottom, plus floating windows (in-page floating panels; a popout browser window can come later). Each slot is a resizable tab-stack of widgets.
- **Operations**: add widget (Widgets menu / command palette), move by drag between slots or into a float, resize, hide/show a slot, close/delete a widget instance, maximize, and optional per-screen visibility overrides (e.g. hide the right docks on the Script screen).
- The layout model is pure data. Every mutation goes through `layout.apply(op)`, so it is undoable in its own `layout` history context and serialisable.
- Named layouts are saved as settings (any scope) and can be reset to default. Plugins contribute default placements.

### 4. Settings — IntelliJ-like layering (`settings`)

- Scopes, lowest → highest precedence:
  1. **Default**: from the schema.
  2. **Account**: synced through the API.
  3. **Machine**: this browser/install only, IndexedDB.
  4. **Project**: committed to `.nanoforge/editor/settings.json`.
  5. **Project-local**: gitignored `.nanoforge/editor/local.json`; server-side in ONLINE mode.
- Each setting key declares `allowedScopes`, a zod schema and a description (for the UI and search).
- `settings.get(key)` returns a reactive, merged value. `settings.inspect(key)` returns the value at each scope. `settings.set(key, value, scope)` writes one scope.
- Storage adapters sit behind one interface:
  - `IndexedDbStore` (machine + account cache)
  - `ProjectFileStore` (via the project FS service)
  - `RemoteAccountStore` (proxied through the editor server, which already holds the API key and refresh-token middleware)
- Sync:
  - The account document has a `revision`. Writes go to an offline queue and are flushed with `If-Match`.
  - On `409`, keys are merged three ways against the last synced base; true conflicts go to a prompt.
  - Settings marked `sync: false` never leave the machine.
- Layouts, keymaps, theme, enabled plugins and the history limit are all ordinary settings.
- Settings UI (a plugin): tree + search, scope switcher, "modified" markers, reset, import/export.

### 5. History (`history`)

- `Command { label, do(), undo(), mergeKey?, merge?(next) }`, which may be async, plus `history.transaction(label, fn)` for grouping (e.g. a gizmo drag = 1 step; consecutive slider changes merge within N ms).
- **Contexts**:
  - one stack per document or target: each codegen target file, the layout, settings changes, and plugin-defined contexts;
  - `HistoryRouter` sends Ctrl+Z/Y to the context of the focused widget;
  - Monaco keeps its native undo;
  - the history panel shows every context.
- **Limit**: the `history.limit` setting (default 100) applies to each stack, and the oldest entries are dropped.
- **Codegen consistency**: file-backed commands record the file's content hash after `do`. If the file changed outside the editor (hand edit, git pull), that context's stack is invalidated past that point, with a notice. This matches Godot and Unity behaviour.

### 6. Project, FS, RPC and server (`project`, `rpc`, `server-core`, `apps/editor`)

- The server is the source of truth: the disk in OFFLINE mode, the git checkout of the gateway project in ONLINE mode.
- The client `ProjectFs` service:
  - read/write/list;
  - OPFS content cache plus IndexedDB tree cache;
  - WS watch events from a chokidar/Bun watcher.
- **Workspace discovery**:
  - Parse the root `nanoforge.config.ts` with `@nanoforge-dev/config` `parseConfig`/`resolveConfig` on the server, expand `packages` globs and resolve each app (`client`/`server`/`lib`, `dir.*`, `editor.entryFile`, `language`).
  - Expose the result as `ProjectModel.apps`. This is the basis of the client/server/shared context switch.
- **Stable project identity**: keyed by resolved path (OFFLINE) or gateway id (ONLINE), separate from the session id. This fixes the current bug where tabs and caches are lost after a session change.
- **RPC**:
  - Typed contracts shared between client and server: zod-validated input, an `/rpc/<namespace>.<method>` endpoint, and a single WS for streams.
  - This replaces the SvelteKit form actions.
  - Plugins' server entries register their own namespaces.
- Sessions/auth, the `nf` CLI wrapper, git and the API client are rewritten into `server-core` as services.

### 7. Code service & codegen (`code` in core, ECS logic in the ECS plugin)

- A **Web Worker** runs TypeScript and ts-morph over an in-memory project, kept in sync from `ProjectFs`. It is lazy-loaded. Running on the client makes behaviour identical offline and online, and lets plugins ship `entry.worker` analyzers and transformers without server code.
- **Core API** (generic, **knows nothing about ECS or scenes**):
  - `code.analyze(file, analyzerId)` returns a plugin-defined model plus node references.
  - `code.transform(file, transformerId, op)` edits the AST minimally, keeps formatting, and returns a text edit.
  - Unknown statements are reported as `codeOnly` ranges for read-only display.
  - Literal-extraction helpers (read the literal value of an exported const) are provided for plugins.
- **Edits go through a single `TextDocumentService`**: if the file is open in Monaco, the edit is applied to the Monaco model (so there are no dirty-buffer conflicts, and the editor's own edits don't trigger hash invalidation); otherwise it goes to `ProjectFs`. Either way it is wrapped in an undoable history command.
- **`codegen.target` extension point** (core defines it; core provides **no** implementation):
  - The **ECS plugin** provides the default "entry-file" target. It reads and writes entities, components and systems in the app's `editor.entryFile` (`main.ts`): `registry.spawnEntity()`, `addComponent(e, new X({...}))`, `addSystem(fn)`.
  - **Discovery** (ADR 0003): core owns a generic catalog of items, read from TSDoc in the sources. The code worker generates the meta into the editor cache (`.nanoforge/editor/cache/meta/`) at init when missing and when stale; it is never published. ECS data sits in owner objects (`"@nanoforge/ecs": { "type": "component" }`) that only the ECS plugin parses, and its component and system registries are views over the catalog.
  - A **scene plugin** overrides the target at higher priority to use `dir.scenes/*.scene.ts`, and replaces the scene widget.
  - If no provider exists, the viewport's Scene screen shows an empty state.
- Golden round-trip tests (in the ECS plugin) run on `engine/example/pong-network` and `engine/e2e/game`.

### 8. Runtime (`runtime`)

- **Build**: the server runs `nf build --editor --watch` per app and streams progress and errors to the Problems view and Console.
- **Client play (same page)**:
  - Mount a container in the Game screen and `import()` the built `main.js` with a cache-busting version.
  - Call `main({ container, files, env, editor: { toEditor, fromEditor } })`.
  - `files` is built from the build output the way the loader does it. `env` gets the same `NANOFORGE_CLIENT_*` prefix stripping as `nf start`.
  - Stop means sending the `stop` command, awaiting `__clear`, then removing the container.
  - Risk to note: game globals can leak into the editor page. Mitigation: always a full stop plus remount, and a "Reload editor runtime" command.
- **Server play**: the editor server starts the built server `main.js` through `loader-server` as a child process, with `NANOFORGE_SERVER_*` env. It is bridged to the editor over IPC → WS (needs the loader change), with logs streamed.
- **Play modes**: Client only / Server only / Server + client. "Open extra client" opens a new browser tab on `loader-client`, because the same-page runner can only host one client.
- Pause / resume / stop / step through editor-lib commands.

### 9. Default, overridable features (plugins, requirements sessions pending)

Each is a **built-in plugin** exposing its own extension points, so other plugins can change it. Its exact features are defined with the user before implementation.

- **code-editor**: Monaco `Script` screen; contributes language features, diagnostics from the code worker, and file-type editors.
- **file-manager**: dock widget; contributes file actions, file icons and create templates (component/system via the manifest conventions).
- **viewport**: `Game` screen (runtime host) and `Scene` screen with the `viewport.modes` / `scene.editor` extension points. It renders whatever `codegen.target` provider exists (the ECS plugin's entry-file target by default). A scene plugin replaces both. With no provider, the screen shows an empty state.
- **ecs**: the current features, done better. It owns the entry-file codegen target and manifest discovery. It provides the hierarchy, the inspector (field editors per `Element` type, extensible; `ref` editors come from the plugin for that lib), the component/system browser, the client/server/lib context, and live world inspection during play.

### Feature parity checklist (inputs to the plugin requirements sessions)

From the current editor (`src/lib/components/Widget/*`, `src/lib/client/ecs/*`, `src/routes/*`):

- **Project picker**: recent projects, create project, open (OFFLINE path / ONLINE gateway), complete-setup (`/load`). → Shell (phase 5).
- **ECS tree** (`ecs-tree`): tabs for scenes (multiple scenes, per-scene system list, entity tree with folders, create/edit/delete entity), components and systems (create package, import package), libraries (install npm/nanoforge libraries), assets (create asset). → ECS plugin (a scene plugin takes over multi-scene).
- **Entity inspector**: component list, add component (selector dialog), param rows per `Element` type. → ECS plugin.
- **Content browser**: folder side list, item grid, icons, current dir. → file-manager plugin.
- **Code editor**: Monaco with project types loaded (`CodeEditor/project-loader.ts`). → code-editor plugin.
- **Editor game**: same-page run with hot-reload of components and graphics-2d drag-to-move. → runtime + viewport + ECS (drag emits a codegen edit).
- **Output log** → console plugin. **Marketplace dialog** (search, tabs, details, install) → marketplace plugin.
- **Menu bar + export dialog** (archive export `/fs/archive`) → shell menus + a "project export" command.
- **i18n**: Paraglide (en/fr) is set up but holds almost no strings. The new kernel gets a `localization` contribution (per-plugin message bundles, locale setting) so the shell and plugins are translatable from day one.
- **console/problems, command-palette + keymaps, runtime inspectors (world, profiler, network), git, marketplace, history-panel, settings-ui**.

---

## Implementation plan — step by step

Conventions for every step:

- **Deliverable:** what exists when the step is merged.
- **Done when:** the check that must pass (tests, demo).
- Each phase is a sequence of small PRs into `rewrite/v2`, using conventional commits with the scope set to the package name (`feat(kernel): …`).
- Plugin phases (9–11) always start with a **requirements session with the user**, which produces a short spec in `docs/specs/<plugin>.md` before any code is written.

### Milestones and ordering

| Milestone               | Phases     | Demo                                                              |
| ----------------------- | ---------- | ----------------------------------------------------------------- |
| M1 "Boots with plugins" | 0, 1, 2    | Editor opens a project, loads a test plugin, lists apps and files |
| M2 "Customizable shell" | 3, 4, 5    | Godot layout with docks, persisted layouts/settings, undo/redo    |
| M3 "Code & runtime"     | 6, 7, 8    | AST edits of files, play client + server from the editor          |
| M4 "Feature parity"     | 9, 10      | Default plugins + ECS plugin cover the parity checklist           |
| M5 "1.0"                | 11, 12, 13 | Extra plugins, backend contract, docs, release                    |

What can run in parallel:

- Phases 3 and 4 are independent once phase 1 is done.
- Phase 8 (other repos) can start right after phase 2.
- Phase 6 can start after phase 2, in parallel with phase 5.

---

### Phase 0 — Reset & scaffold

0.1 **Branch.** The current branch has an uncommitted `package.json` change, so don't switch branches in place. Instead create a worktree: `git worktree add ../editor-v2 -b rewrite/v2 main`. All rewrite work happens there.

0.2 **Remove the old app.** Delete:

- `src/`, `e2e/`, `.temp/`
- `messages/`, `project.inlang/`
- `components.json`, `uno.config.ts`, `svelte.config.js`, `vite.config.ts`

Keep `docs/`, `.github/`, `Dockerfile`, `nanoforge.yaml`, the lint/format/commit configs, `cliff.toml` and `LICENSE`.

0.3 **Root workspace.**

- `package.json` (private; scripts `dev`, `build`, `lint`, `format`, `test`, `test:e2e`, `typecheck`, all run through turbo).
- `pnpm-workspace.yaml`: `apps/*`, `packages/*`, `plugins/*`, `tooling/*`, keeping the existing catalogs.
- `turbo.json` pipelines: `build` depends on `^build`; `test` and `lint` have no dependencies.

0.4 **Shared tsconfig** (done at the repo root, `tsconfig.json`, like the engine repo; `tooling/` is kept for the plugin build tooling). Three base configs: `base.json` (strict, `moduleResolution: bundler`, `verbatimModuleSyntax`, target ES2023), `lib.json`, and `svelte.json`.

0.5 **ESLint.** The root `eslint.config.js` builds on `@nanoforge-dev/utils-eslint-config`, plus `eslint-plugin-svelte` and import-boundary rules:

- `packages/kernel` imports no other internal package;
- `plugins/*` may import only `@nanoforge-dev/editor-sdk`;
- `packages/*` never import `plugins/*`.

0.6 **Package conventions.**

- Internal packages are **source-only**: `exports` points at `src/index.ts`, and the app bundles them.
- Only `@nanoforge-dev/editor-sdk` gets a real build (tsdown + `.d.ts`), because external plugins compile against it.
- Every package has `package.json`, `src/index.ts`, `tsconfig.json` and `README.md`.
- Naming is `@nanoforge-dev/editor-<name>`.

0.7 **Test setup.** One root Vitest config with three projects:

- `node`: `packages/**/*.test.ts`
- `browser`: `**/*.svelte.test.ts`, Playwright/Chromium
- `plugins`

Playwright e2e lives in `apps/editor/e2e`, with fixtures copied from `engine/example/pong-network` into `apps/editor/e2e/fixtures/`.

0.8 **CI and release.**

- `tests.yml`: `pnpm install` → `turbo lint typecheck test`.
- `release.yml`: release the `apps/editor` package.
- Dockerfile: `pnpm --filter @nanoforge-dev/editor build`, then run `apps/editor/dist/index.js`.
- Commitlint: allowed scopes = package names.

0.9 Create empty packages (`kernel`, `sdk`, `rpc`, `history`, `settings`, `layout`, `ui`, `project`, `code`, `runtime`, `server-core`) and `apps/editor` (SvelteKit + `svelte-adapter-bun` hello page).

**Done when:** `pnpm i && pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass on CI, and `docker build` works.

### Phase 1 — Kernel (`packages/kernel`, `packages/sdk`)

1.1 ✅ **Svelte runtime spike (go/no-go): GO.** An externally built widget (`tooling/spike-plugin`) shares the host's Svelte runtime through the build-time shared-module rewrite (`tooling/vite-plugin`). Verified in dev and prod by `apps/editor/e2e/plugin-runtime.check.mjs`. See [ADR 0001](adr/0001-plugin-ui-runtime.md).

1.2 ✅ **Lifecycle.** `Disposable`, `DisposableStore`, `toDisposable`, `combineDisposables`, `MutableDisposable`, plus a leak-tracking helper for tests.

1.3 ✅ **Events.** `Emitter<T>` (`event(listener) → Disposable`, `once`, `fire`, `dispose`), `Event.map`/`filter`/`debounce`, and a typed `EventBus` whose channel map is extended by module augmentation.

1.4 ✅ **Observables.** A minimal framework-agnostic `Observable<T>`/`derived` (subscribe → Disposable). The sdk adapts it to Svelte (`toStore`, `fromObservable` rune helper). The core stays independent of Svelte.

1.5 ✅ **DI.**

- Tokens: `createToken<T>(id)`.
- `Container` with parent/child scopes (app → project → plugin), `provide(token, value | factory, { priority })`, `override(token, decorator)`, `get` / `tryGet` / `getAll`.
- Instantiation is lazy, with cycle detection and disposal cascading down to children.
- Tests cover priority resolution, override chains and scope isolation.

1.6 ✅ **Extension points.**

- `defineExtensionPoint<T>(id, { schema, multiple, sort })` and `ExtensionRegistry.contribute(point, value, owner) → Disposable`.
- `observe(point) → Observable<T[]>`, sorted by priority then order.
- Contributions are validated with zod, and errors are attributed to the owning plugin.

1.7 ✅ **Context keys and `when` clauses.**

- `ContextKeyService` with scoped overlays (global → screen → widget).
- A `when` parser that compiles to predicates. Operators: `&&`, `||`, `!`, `==`, `!=`, `=~`, `in`, parentheses.
- Unit-tested grammar.

1.8 ✅ **Commands.** `CommandRegistry.register(id, handler, { when, title, category, icon })`, `execute(id, ...args)`, `onDidExecute`, and handler access to services through an accessor.

1.9 ✅ **Localization.** `LocalizationService`: namespaced message bundles (`en` fallback), `t(key, params)` with plural/select-lite, and a locale observable (bound to the `locale` setting in phase 3).

1.10 ✅ **Logger.** `LoggerService` with named, scoped loggers and pluggable sinks (browser console now, the Console plugin later).

1.11 ✅ **Plugin manifest schema.**

- A zod schema for `nanoforge.manifest.json` `type: "plugin"`, with fields: `name`, `version`, `displayName`, `description`, `tags`, `engines.editor`, `dependencies`, `optionalDependencies`, `engineLibs.required|optional`, `entry.client|server|worker`, `activation[]`, and `contributes.*`.
- Export a JSON Schema (`schemas/plugin.schema.json`) for IDE completion.

1.12 ✅ **Resolver.**

- Builds the dependency graph with `semver` checks.
- Detects missing or incompatible dependencies, incompatible `engines.editor`, and cycles.
- Produces an activation order and a status per plugin (`ok`, `missing-dependency`, `incompatible`, `disabled`, `error`).

1.13 ✅ **Plugin host.**

- `PluginSource` interface (`list()`, `resolveUrl(entry)`).
- Static manifest contributions (commands, menus, settings, widgets, keybindings) are registered **before** activation, so the UI can show them for lazily activated plugins.
- The activation event dispatcher handles `onStartup`, `onCommand:*`, `onScreen:*`, `onWidget:*` and `onProjectType:*`.
- `PluginContext` provides `subscriptions`, a scoped DI container, `logger`, `t`, `storage` (per-plugin KV), `eligibleApps` and `manifest`.
- `activate` and `deactivate` run with timeouts.
- If a plugin throws, it is marked `error` and its dependents are deactivated.

1.14 ✅ **Engine-lib gating.**

- `EngineLibProvider` interface; its implementation comes in phase 2.
- Each plugin gets `eligibleApps: Observable<App[]>`, the apps that satisfy `engineLibs.required`.
- The context keys `plugin.<name>.eligible` (for the current app context) and `engineLib:<pkg>` are set.
- When a required lib is missing, the plugin gets a `quickFix` contribution: "Install <lib> in <app>".
- The plugin activates once and gates its features per app.

1.15 ✅ **Loader and dev hot reload.** (`PluginHost.reload` and the `import()` loader are done; the `LocalDevSource` that triggers reloads on rebuild needs the server watcher and is wired in phase 2.12.)

- A plugin module loader: installs the `SharedModuleRegistry`, then `import()`s plugin entries by URL.
- `LocalDevSource` watches rebuild events → deactivate → re-import with `?v=<hash>` → reactivate. Widget state is preserved through the `getState`/`setState` hooks (phase 5).

1.16 ✅ **SDK.** (Deviation: instead of api-extractor, a snapshot test of the SDK's runtime exports makes API changes visible in PRs. `EventBus` is generic and `EditorEvents` is declared in the SDK so module augmentation works.)

- `definePlugin({ activate, deactivate })`, public re-exports and type helpers.
- Built with tsdown, with an `api-extractor` report checked in so public-API changes are visible in PRs.

**Done when:** kernel coverage is ≥ 90%, and a fixture set of 3 plugins (A depends on B, C optionally depends on A, D requires a missing engine lib) resolves, activates in order, and unloads with no leaked disposables.

### Phase 2 — Server foundation & RPC ✅

Architecture recorded in [ADR 0002](adr/0002-editor-server.md). Deviations from the steps below:

- The UI is a static SvelteKit SPA served by a plain Bun server (not `svelte-adapter-bun`).
- Contracts live in a new `packages/protocol`.
- ONLINE sign-in reuses the NanoForge website cookies (no login form).
- Configs are executed only offline; online they are read statically.

2.1 ✅ **App skeleton.** `apps/editor` with SvelteKit, `svelte-adapter-bun`, and an env schema validated by zod at startup: `PUBLIC_MODE` (OFFLINE|ONLINE), `FS_ROOT`, `API_URL`, `API_KEY`, `SESSION_SECRET`, `PORT`, `PLUGINS_DIR`.

2.2 ✅ **`packages/rpc`.**

- `defineContract(ns, { methods: { m: { input, output } }, streams: { topic: { params, event } } })`.
- Server router: `/rpc/:ns.:method`, JSON with a binary-safe envelope, zod validation, `RpcError(code, message, data)`, abort signals.
- Typed client proxy.
- Multiplexed WebSocket `/rpc/ws`: subscribe/unsubscribe, server push, heartbeat, reconnect with automatic resubscription, per-topic backpressure (coalescing).

2.3 ✅ **`server-core` container.** Reuses the kernel DI on the server. Registers the `Env`, `Logger` and `Clock` services.

2.4 ✅ **Sessions and auth.**

- A signed-cookie session store.
- OFFLINE uses an implicit local user; ONLINE logs in through the API (token pair).
- A refresh-token middleware in the API client.
- An RPC auth guard, with per-method `public` flags.

2.5 ✅ **API client.** A typed fetch wrapper for `api.nanoforge.eu` (retry, refresh, error mapping). Endpoints are added as later phases need them.

2.6 ✅ **CLI service.**

- Finds the `nf` binary (from the project's `node_modules/.bin`, else a global install).
- `run(args, { cwd, env, signal }) → { exitCode, stream }`, with output streamed as `cli:<runId>`.

2.7 ✅ **Git service** (ONLINE gateway projects): clone, pull, status, commit and push through the git CLI, serialized per project with a lock.

2.8 ✅ **Project registry.**

- `openProject({ path } | { gatewayId })` returns a `ProjectHandle` with a **stable** `projectId`: a hash of the realpath, or the gateway id.
- It is separate from the session.
- Recent projects are stored per user on the server.

2.9 ✅ **Workspace discovery.**

- Load the root `nanoforge.config.ts` with `@nanoforge-dev/config` `parseConfig`/`resolveConfig`, expand the `packages` globs and resolve each app.
- Build the `ProjectModel { root, apps: App[] }`, where `App = { id, name, type: client|server|lib, root, dirs, entryFile, editorEntryFile, language, outDir, engineLibs: {name, version}[] }`.
- `engineLibs` come from the app's `package.json` (`@nanoforge-dev/*`, plus the config `libs`).
- Re-run discovery when a config or `package.json` changes, and push the model over WS.

2.10 ✅ **Server FS service.**

- Root-jailed path resolution (rejects `..` and symlink escapes).
- `read` (text or binary), `write` (atomic temp + rename), `stat`, `list`, `mkdir`, `rename`, `copy`, `delete` (to the trash dir `.nanoforge/editor/trash`).
- The watcher (chokidar) ignores `node_modules`, `.git` and out dirs, batches events every 50 ms, and publishes on the `fs:<projectId>` topic.

2.11 ✅ **Client `ProjectFs`.**

- RPC-backed, with an OPFS content cache keyed by `projectId` + path + mtime, and an IndexedDB tree cache.
- Applies watch events and exposes an `onDidChange` event.
- Writes go through the server.
- Exposes `EngineLibProvider` over `ProjectModel`.

2.12 ✅ **Plugin sources on the server.**

- Scan the bundled plugins (`apps/editor/build/plugins`), user-installed plugins (`~/.nanoforge/editor/plugins/<name>@<version>`) and local-dev paths (setting).
- Serve them at `/plugins/<name>/<version>/*`: immutable cache for installed plugins, no-cache for dev.

2.13 ✅ **Plugin server entries.**

- Import `entry.server` into Bun.
- `ServerPluginContext`: register the RPC namespace `plugin.<name>`, and access the fs, cli, git and logger services.
- Disposed when the plugin is disabled.

2.14 ✅ **Client bootstrap.**

- Install the shared module registry and fetch the plugin list.
- Build the kernel container, register the core client services (rpc, projectFs, project model, logger, i18n), and start `PluginHost`.

**Done when:**

- An integration test opens a copy of pong-network and gets a `ProjectModel` with 2 apps and their engine libs.
- A file written on disk shows up in client `ProjectFs` within 200 ms.
- A fixture plugin with a server entry answers a namespaced RPC call.

### Phase 3 — Settings (`packages/settings`) ✅

Implementation notes:

- The account scope goes through the editor server (the API key stays server-side). Online
  editors use `GET/PUT /users/me/editor-settings` ([contract](api/settings-sync.md)); offline ones
  store the same revisioned document in the data dir.
- Values stored in a scope a setting does not allow are ignored (a committed project file cannot
  force machine-level settings).
- Hosted editors keep project-local settings server-side per user, outside the shared checkout.
- Manifest settings (`contributes.settings`) use a small JSON type vocabulary; code uses zod
  (`defineSetting`).
- `plugins.devPaths` and `editor.mode` stay server environment variables (`DEV_PLUGINS`,
  `PUBLIC_MODE`), not settings.

3.1 ✅ **Schema registry.**

- Settings come from `contributes.settings` (static) and `defineSetting(key, { schema, default, scopes, sync, mergeStrategy, category, order, tags, description, deprecated })`.
- Keys are namespaced (`<plugin>.<key>`).
- A JSON Schema is derived for the settings UI.

3.2 ✅ **Store interface.** `SettingsStore { scope, load(), write(patch), onDidChange }`, with these implementations:

- `DefaultStore`: from the schemas.
- `MachineStore`: IndexedDB.
- `AccountStore`: IndexedDB cache plus remote sync (3.5).
- `ProjectStore`: `.nanoforge/editor/settings.json` through `ProjectFs`, with stable key order and 2-space JSON.
- `ProjectLocalStore`: `.nanoforge/editor/local.json`, which also adds a `.gitignore` entry. In ONLINE mode it is stored server-side per user and project.

3.3 ✅ **Resolution engine.**

- Precedence: default < account < machine < project < project-local.
- `mergeStrategy` is one of `replace` (default), `deep` or `union`.
- Values are exposed as Observables per key, and are memoised.

3.4 ✅ **Public API.**

- `get(key)`, `observe(key)`, `inspect(key)` (value per scope + effective scope), `set(key, value, scope)`, `reset(key, scope)`, `onDidChange(keys[])`.
- Writes are validated; writing to a scope the key doesn't allow is rejected.
- Migrations: `renamedFrom`, and deprecation notices.

3.5 ✅ **Account sync.**

- A document `{ revision, values }`.
- The offline queue is persisted in IndexedDB and flushed on reconnect with `If-Match`.
- On 409: fetch, then merge three ways per key against the stored base. True conflicts raise a `settings.conflict` event for the UI to prompt.
- Exponential backoff, and a `SyncStatus` observable for the status bar.
- Keys with `sync: false` are filtered out.

3.6 ✅ **Mock API.** A small Bun mock server used in tests, implementing the contract.

3.7 ✅ **Contract doc.** `docs/api/settings-sync.md`:

- `GET/PUT /users/me/editor-settings`, headers, 409 body, limits (size, key count), versioning.
- Plugin-enable lists and installed marketplace plugins per account.

3.8 ✅ **Import/export.** Export a scope to JSON and import with a preview.

3.9 ✅ **Core settings.** Define `locale`, `appearance.theme`, `history.limit`, `layout.*`, `keymap.*`, `plugins.enabled`, `plugins.devPaths` and `editor.mode`.

**Done when:** unit tests pass for precedence, merge strategies, scope restrictions, migrations, an offline edit followed by reconnect sync, and a 409 conflict with a 3-way merge.

### Phase 4 — History (`packages/history`) ✅

Implementation notes:

- Transactions receive a handle (`tx.push`, `tx.transaction`): commands pushed outside of it wait
  for the transaction instead of being swallowed into it.
- File edits are offset-based `TextEdit` operations with computed inverses
  (`FileHistoryTracker.edit`). They go through `ProjectFs` directly until the phase 6
  `DocumentService` exists; the tracker waits for its own in-flight writes before treating a
  change as external.
- `history.undo`/`history.redo` return false for native undo (text inputs, code editor); the
  phase 5 keybinding layer lets those keystrokes through.

4.1 ✅ **Stack.**

- `Command { label, do, undo, redo?, mergeKey?, merge?(next), affects? }`, which may be async.
- `HistoryStack` provides push, undo, redo, `canUndo`/`canRedo`, clear, savepoints (for dirty tracking), and trims to its limit.
- Every command carries an `origin` (`{ kind: 'user' | 'plugin' | 'remote', id }`) and an optional `sizeBytes`. Stacks are trimmed by count (`history.limit`) **and** by a memory budget, so commands holding large binary snapshots stay bounded.
- Commands on documents are expressed as serializable operations on the document (not closures over whole-file text) whenever possible, so they can later be transformed against concurrent changes.

4.2 ✅ **Transactions.**

- `transaction(label, fn)`: nestable and async. Commands inside are collected into one composite, and it rolls back in reverse order on error.
- Commands with the same `mergeKey` are merged within a merge window (setting, default 500 ms).

4.3 ✅ **HistoryService.**

- `registerContext({ id, label, owner })` returns a context with its own stack. The limit is `history.limit`; changing it trims live.
- Serial execution per context, through an async queue.

4.4 ✅ **Router.**

- The `history.undo` and `history.redo` commands (Ctrl+Z, Ctrl+Shift+Z/Ctrl+Y) resolve the target context from the `historyContext` context key of the focused widget.
- If focus is in a text input or Monaco, the native undo runs instead.
- Undo/redo only ever targets commands whose origin is the local user. Changes from other origins are recorded as non-undoable entries that later commands are applied on top of.

4.5 ✅ **File-backed commands.**

- `FileEditCommand(uri, edits)` applies edits through `TextDocumentService` (phase 6) and records the file hash afterwards.
- `ProjectFs` change events whose hash doesn't match mean the file was changed from outside. The context is invalidated from that point, and a notification is shown.

4.6 ✅ **Change events.** `onDidChange(contextId)` with the entries, labels and current index, for the History panel.

**Done when:** unit tests cover limit trimming, the merge window, nested transaction rollback, async ordering, the router's focus resolution and external-change invalidation.

### Phase 5 — UI & layout (`packages/ui`, `packages/layout`, shell in `apps/editor`) ✅

Implementation notes:

- Design direction: blue-grey steel surfaces, the NanoForge brand violet as accent (same as the
  landing page and web workspace; lifted in the dark theme for contrast), blue focus/selection,
  one violet-to-blue gradient (active screen marker, startup progress). Instrument Sans +
  JetBrains Mono, self-hosted.
- Splitters are a small custom component (pixel sizes map directly to the layout model) instead
  of paneforge.
- Undoable layout steps: open/close/move/float/dock/resize/toggle. Switching tabs or screens
  and raising a window are navigation, not undo steps. Ctrl+Z falls back to the layout history
  when the focused panel has no history context.
- Icons are registered by name (core set + `registerIcons` for plugins) to keep bundles small.
- Core panels (Project screen, Files, Plugins, History, Output) live in `apps/editor` until the
  plugins of phases 9–11 replace them.
- `nf new` project creation and the online project list are RPC methods of `projects`.
- End-to-end suite: `apps/editor/e2e` (Playwright, production build).

5.1 ✅ **Theme tokens.**

- Token spec in `ui/src/theme/tokens.ts`: semantic colors (bg, surface, border, text, accent, danger, warning, success, selection, focus), spacing, radius, typography, shadow, z-index, motion.
- Tokens map to CSS custom properties `--nf-*`.
- Built-in `nanoforge-dark` and `nanoforge-light` themes.
- `ThemeService` applies the `appearance.theme` setting, and themes can be contributed through an extension point.
- A UnoCSS preset maps the tokens for plugin authors.

5.2 ✅ **Style injection.**

- `StyleService.inject(owner, css, { widgetId? })` creates a `CSSStyleSheet` added to `document.adoptedStyleSheets`, wrapped in `@layer plugin.<name>`.
- Widget styles are scoped under `[data-nf-widget="<id>"]`.
- Removed on dispose. Layer order is `reset < ui < plugins < user-overrides`.

5.3 ✅ **UI kit** (Svelte 5 on bits-ui, token-styled):

- `Button`, `IconButton`, `Input`, `NumberInput` (drag to scrub), `Checkbox`, `Switch`, `Select`, `Combobox`, `ColorPicker`, `Vector2Input`
- `Tree` (virtualized, keyboard, drag and drop, inline rename), `PropertyGrid`, `Tabs`, `Menu`/`ContextMenu`, `Dialog`, `Toast`, `Tooltip`, `Splitter` (paneforge), `EmptyState`, `Icon` (lucide)
- A browser test for each interactive component.

5.4 ✅ **Widget host.**

- Descriptor: `{ id, title, icon, kind: "dock" | "screen", component | mount, styles, defaultSlot, order, singleton, when, historyContext? }`.
- Instance lifecycle hooks: `onShow`/`onHide`, and `getState`/`setState` for persistence and hot reload.
- An error boundary per widget, with a "reload widget" action.
- Opening a widget activates its plugin lazily (`onWidget:<id>`).

5.5 ✅ **Layout model** (`packages/layout`, pure TS).

- Types: `Layout { version, screens: ScreenId[], activeScreen, slots: Record<SlotId, { visible, size, stack: TabStack }>, floats: Float[], screenOverrides }`, where `SlotId = leftTop | leftBottom | rightTop | rightBottom | bottom`.
- Operations: `addWidget`, `moveWidget`, `closeWidget`, `activateTab`, `resizeSlot`, `toggleSlot`, `floatWidget`, `dockFloat`, `moveFloat`, `resizeFloat`, `switchScreen`, `maximize`, `setScreenOverride`.
- A pure reducer that returns the new layout plus the inverse operation, so each change is undoable.
- On load, the layout is validated and repaired: widgets from missing plugins become placeholders.
- Versioned serialization with migrations.

5.6 ✅ **Default layout.** Composed from the widgets' `defaultSlot`/`order` when no layout is saved.

5.7 ✅ **Renderer.**

- A shell grid: top bar (menus + screen switcher + play toolbar slot), a left column (2 slots), the center (active main screen), a right column (2 slots) and the bottom slot. Everything is resizable with paneforge.
- Tab stacks, and pointer-event drag and drop with a drop-zone overlay (tab strip, slot, float).
- Floating panels (drag, resize, bring to front).
- Keyboard focus cycling (F6), and a tab context menu (close, close others, float, move to…).

5.8 ✅ **Layout persistence.**

- Settings `layout.saved` (named layouts) and `layout.active`, scope user or project.
- Saves are debounced by 500 ms.
- Commands: save layout as…, switch layout, reset to default.
- Layout changes go into the `layout` history context.

5.9 ✅ **Shell chrome.**

- The menu bar reads the `menus` extension point (File, Edit, View, Run, Help, plus plugin menus).
- The status bar reads the `statusBar.items` extension point.
- A notification center, a View → Widgets submenu that lists every widget, and a screen switcher.

5.10 ✅ **Keybindings.**

- `KeybindingService`: contributions with `when` clauses, chords, platform modifiers, and user overrides in `keymap.overrides`.
- Conflict detection for the future keymap UI.

5.11 ✅ **Project flow.**

- Route `/` lists recent projects and lets you create one (`nf new`, with the multiplayer option → `--server`) or open one (OFFLINE path picker / ONLINE gateway list).
- Route `/project/[projectId]` shows the workspace shell.
- A loading screen shows discovery and plugin activation progress.

**Done when:** browser tests pass for style scoping, layout operations and drag and drop, and the e2e test passes: move and resize a dummy dock, float it, reload, and the layout is restored; Ctrl+Z undoes a layout move.

### Phase 6 — Code service (`packages/code`) ✅

Implementation notes:

- Transformers never print files: they get an `EditBuilder` over node ranges (`replace`,
  `insertAfter`, `removeLines`…), so edits are minimal and formatting is preserved by construction.
- The engine is plain TypeScript (`CodeEngine`), served in the worker by `serveEngine`; tests run
  it behind a `MessageChannel`. ts-morph ships its own TypeScript, independent of the repo's.
- Type declarations of bare imports come from the server (`code.typeFiles`, node_modules lookup
  from the importing file).
- Plugin worker entries receive an owner-bound sdk in `activate(sdk)`; `ts-morph` and
  `@nanoforge-dev/editor-sdk/worker` are shared modules of the worker.
- Undo validity uses a fingerprint of the document content; the `FileHistoryTracker` of phase 4
  stays for callers editing without the DocumentService.
- Temporary `code.check` command (double click a code file in Files) until the code editor plugin.

6.1 ✅ **Worker.**

- `code.worker.ts` with a typed postMessage RPC (a small internal comlink-style layer).
- TypeScript and ts-morph are lazy-loaded, over an in-memory FS.

6.2 ✅ **Mirroring.**

- Mirror the `.ts`/`.js` files of every app and lib into the worker, and load `@nanoforge-dev/*` `.d.ts` on demand from the server so symbols resolve.
- Updates are incremental, from `ProjectFs` events.

6.3 ✅ **Plugin worker entries.** Plugins' `entry.worker` modules are imported into the worker and call `registerAnalyzer(id, fn)` / `registerTransformer(id, fn)`, through a worker-side sdk (`@nanoforge-dev/editor-sdk/worker`).

6.4 ✅ **Main-thread API.**

- `code.analyze(uri, analyzerId, args)` returns a plugin-defined model with node references (stable ids built from path + position + kind).
- `code.transform(uri, transformerId, op)` returns `TextEdit[]`: the minimal edits, computed per changed node, so formatting elsewhere is preserved.

6.5 ✅ **Literal helpers.**

- `readExportedLiteral(uri, name)`.
- `valueToLiteral` / `literalToValue`, covering strings, numbers, booleans, null, arrays, objects, negative numbers and template-free strings.
- Diagnostics for non-literal values.

6.6 ✅ **`DocumentService`** (the single path for every document edit).

- Registry of open documents of three kinds: text, binary, and custom models (a plugin-defined structure serialized to a file).
- A `documentEditors` extension point maps file patterns to editor widgets ("open with"); Monaco is just the provider for text documents.
- `applyEdits(uri, edits, { label, origin })` edits the open document if one exists, otherwise writes through `ProjectFs`. It returns a history command.
- Change events carry the edit origin.
- Tracks dirty state, save and revert.
- Storage goes through a `DocumentBackend` interface. The only implementation for now is "file via ProjectFs"; a shared or live-synced backend can be added later without changing editors or history.

6.7 ✅ **`codegen.target` extension point.**

- Interface `CodegenTarget<Model, Op> { id, priority, appliesTo(app), load(app) → Observable<Model>, apply(op) → Command }`, plus `selectTarget(app)`, which picks the highest-priority provider.
- Core has no provider.

6.8 ✅ **Diagnostics.** `DiagnosticsService` collects TS diagnostics and analyzer or plugin diagnostics per URI and exposes them as observables, for the Problems panel.

**Done when:**

- Unit tests pass with a toy transformer that renames a const: an unchanged parse and print is byte-identical on every file of pong-network, and an edit changes only the expected range.
- Edits go to the Monaco model when the file is open (tested with a fake provider).

### Phase 7 — Runtime (`packages/runtime`) ✅

Implementation notes:

- **Engine change pulled forward from phase 8.** No game registered `EditorLibrary`, so nothing
  could pause or stop a game. The engine core now handles the base bridge commands itself
  (`pause`, `resume`, `step`, `stop`), says `hello` with `EDITOR_PROTOCOL_VERSION` after init, and
  reports its run state (`running`, `paused`, `stopped`), sending `stopped` after every library
  was cleared. The change is in the engine branch `feat/core-editor-bridge`, stacked on
  `feat/add-dynamic-resize`.
- Builds are one-shot `nf build --editor --directory <app>` runs, triggered by the project
  watcher while a client is subscribed to `runtime.events`. We don't use `--watch`: it empties
  the output before each rebuild and only watches the entry's folder. A full pong build takes
  about 0.7 s.
- The server runner belongs to the editor: a small Bun script, written to `DATA_DIR/runtime`,
  starts the game's `main({ files, env, editor })` and bridges it over Node IPC. It runs detached,
  so `stop` can kill the whole process group after the grace period. It does not use
  `loader-server --editor-ipc`, so phase 8.6 is no longer needed by the editor.
- Every client run imports `main.js?v=<hash>&run=<n>`, so module state never leaks between runs.
  Games render in a stage element owned by `RuntimeService`, which is moved between Game views,
  so a game keeps running while another screen is shown.
- The client `files` map holds versioned URLs of `/runtime/<projectId>/<app>/…`, served with
  immutable caching. The content-addressed OPFS cache and the `FileEntry` hash (7.2) are
  **deferred** until the source-file cache is built (the dynamic cache in "Future features").
- The `assetProcessors` extension point (7.1) is **deferred** to the first plugin that needs it
  (sprite editor, music creator): its contract depends on where converters run.
- Build diagnostics are shown in Output and in the Game screen. They are not in
  `DiagnosticsService` yet, which needs offsets; that comes with the Problems panel (11.1).
- The runtime is local-only: hosted (ONLINE) editors never build or run project code.
- "Open extra client" opens `/play/<projectId>?app=…`, a full-page client runner in the editor
  app, instead of spawning `loader-client`. `runtime.env` overrides travel in the URL fragment.

7.1 ✅ **Build orchestrator** (server). An `assetProcessors` extension point (file pattern → converter run before the build) lets plugins turn editor-specific source formats into files the engine loads.

- Runs `nf build --editor` per app on source changes (see the notes: not `--watch`).
- Parses the output into diagnostics.
- Publishes status (`idle`, `building`, `ok`, `error`) on the `runtime:<projectId>` topic, and restarts when the config changes.

7.2 ✅ **Output serving.** `/runtime/<projectId>/<appId>/*` serves from `out.dir`, along with a manifest endpoint (file list + **per-file content hash**), following `loader/apps/client/src/manifest.ts`.

- `FileEntry` gets an optional content hash. The server computes it lazily and caches it per path, mtime and size.
- The client content cache (OPFS) becomes content-addressed (keyed by hash), so the same bytes are stored once and reused across source files, build outputs and reloads.

7.3 ✅ **Env service.**

- Read `.env` and the process env.
- Split the `NANOFORGE_CLIENT_*` and `NANOFORGE_SERVER_*` variables and strip the prefixes, as `cli/.../start.action.ts` does.
- Apply overrides from the project-local setting `runtime.env`.

7.4 ✅ **Client runner** (same page).

- State machine: `idle → starting → running ⇄ paused → stopping → idle`, plus `crashed`.
- Mount the container in the Game screen and build the `files` map (blob URLs cached in OPFS, like the loader).
- `import(main.js?v=hash)`, then `main({ container, files, env, editor })`, where `editor` holds the bridge emitters compatible with editor-lib's `QueuedEventEmitter`.
- Errors are captured (window error and unhandledrejection, filtered by the game's origin URL) and sent to the logs.
- Stop sends `stop` and waits for `__clear` with a timeout, then unmounts. A "Reload editor runtime" command handles leaks.

7.5 ✅ **Server runner.**

- Spawn the editor's own runner script (see the notes) with the server env.
- Stream stdout and stderr to the logs, and bridge IPC ↔ WS.
- Supports restart and stop, and kills the whole process tree on exit.

7.6 ✅ **Play controls.**

- Commands `runtime.play`, `pause`, `stop`, `step` and `restart`.
- `runtime.playMode` setting: client, server, or server + client.
- "Open extra client" opens a full-page client of the last build in a new browser tab.
- A contribution slot in the top-bar toolbar.

7.7 ✅ **Plugin API.** `RuntimeService`: `state`, `onEvent(type)`, `send(command)`, typed by the protocol version, with `protocolVersion` negotiation.

**Done when:** e2e runs pong-network with server + client from the editor. It renders, the server logs are streamed, and pause, resume and stop work. Stopping and replaying three times causes no errors.

### Phase 8 — Cross-repo changes (a PR per repo, can start after phase 2) — partly done

Branches (none pushed or published):

- engine `feat/core-editor-bridge` (worktree `../engine-editor-bridge`), stacked on `feat/add-dynamic-resize`;
- loader `feat/server-editor-ipc` (worktree `../loader-editor`);
- cli `feat/editor-open-project` (worktree `../cli-editor`).

The ECS and graphics-2d hooks (8.2, 8.4) move to phase 10: they define what the ECS plugin does during play, so they come from its requirements session. The dependency-related CLI work (the `plugin` manifest type, `nf install` target dirs, `nf publish` for plugins, the `nf create plugin` template) waits for the new dependency model (`nf_modules`, see below).

8.1 ✅ **engine / protocol v2.**

- `@nanoforge-dev/common` holds `EDITOR_PROTOCOL_VERSION` and the typed `EditorCommandMap` and `EditorEventMap` (extensible by augmentation).
- The engine sends `hello` (`protocolVersion`, `libraries`); the editor answers with `welcome` (`protocolVersion`, `features`).
- `Context.editor` is provided by the application whenever an editor starts the game. `EditorLibrary` is deprecated and does nothing.
- Docs: `docs/docs/editor/protocol.mdx` in the engine repo.

8.2 ⏭ **engine / `modules/ecs`: editor hooks.** Moved to phase 10.

8.3 ✅ **engine / `packages/core`.**

- `step`.
- `frame-stats`: sampled, per library, every `intervalMs` the editor asks for.
- Log forwarding: only console calls whose stack contains a frame of the game bundle, so the editor page's own output is never forwarded. Startup output (up to 200 lines) is kept until the `welcome`.

8.4 ⏭ **engine / `graphics-2d`.** Moved to phase 10 (the old drag code keyed on `__RESERVED_entityId` is untouched).

8.5 ✅ **engine / `network`.** Sampled, rate-limited `network-trace` events for TCP and UDP, on client and server, when the editor asks for them.

8.6 ✅ **loader-server.**

- `--editor-ipc`: the worker bridges `RunOptions.editor` over IPC, and the server relays both ways. The worker exits with the editor.
- Fixed the discarded `main.js` filter and the file list that accumulated across calls.
- Tests with `bun test`.
- Bun pitfall: `import * as process from "node:process"` receives no IPC messages; use the global `process`.

8.7 **cli** (✅ open a project directly; ⏸ the rest waits for the dependency model).

- ✅ `nf editor [path] [--port 5173]`: roots the editor at the working directory (or at the project's parent when the project is outside of it), waits for the editor to answer, then opens `/load?path=<project>`.
- ✅ The editor's `/load?path=` and `/load?gatewayId=` route: the "Open in editor" button of the project manager (`${NEXT_PUBLIC_EDITOR_BASE_URL}/load?gatewayId=…`) works unchanged.
- ⏸ The `plugin` manifest type, the `nf create plugin` template, `nf publish` for plugins, the `nf install` target dirs.

8.8 ✅ **Compatibility.**

- The editor answers each `hello` with its features: frame stats for every game, console output for clients only (servers already stream theirs). Plugins add features with `RuntimeService.useFeatures`.
- Legacy engines (no `hello`) and older or newer protocols get an actionable message: a notification once, and a banner on the Game screen.
- Frame stats show in the status bar while playing.

**Done when:** each repo's CI passes, and the editor e2e from 7 passes against the published betas. (Local runs pass against the engine worktree. Publishing is up to the maintainers.)

#### Preparing for `nf_modules` (bundled dependencies)

Components, systems, templates, assets and plugins will be bundled, grouped by `nanoforge.manifest.json` files, and installed into `nf_modules/`. The user can use them there but not change them, and copies one into the project to modify it. The editor prepares for this without building it:

- **Read-only paths** (`nf_modules/**`), enforced by the server file system. Documents open read-only and the Files panel shows a lock.
- ✅ **Plugins and packages are separate.** Packages go in `nf_modules`; plugins go in `~/.nanoforge/editor/plugins` (every project) or `<project>/.nanoforge/plugins` (the `project` source, loaded while the project is open, shadowing the home copy; `PluginHost.update` swaps the plugin set). Packages name the plugins they work best with in `suggestedPlugins`: the editor shows the missing ones in a notification when the project opens (ADR 0003).
- **Watcher and code worker:** don't watch `nf_modules` contents, since they only change on install. The worker reads its sources only to regenerate a stale meta (ADR 0003).
- **One module-resolution function** in the code package decides how generated code imports a package's component or system.
- **Phase 10:** the ECS plugin reads components and systems from the core catalog (ADR 0003: items with owner objects, origin project or package, read-only), filled by providers (project packages and apps, `nf_modules`), never by scanning folders itself. "Copy to my components" is an undoable command that copies the entry into the project and updates imports.

### Phase 9 — Core default plugins (a requirements session for each, first) ✅

Order agreed with the user: code-editor → file-manager → viewport → history-panel → settings-ui.

Shared groundwork, done with the code editor:

- `@nanoforge-dev/editor-sdk/ui`: a shared module with widgets, workbench contributions, UI services and the component kit. The published SDK does not ship its type declarations yet; in-repo plugins use the sources.
- `documents.open` and manifest `documentEditors` (with the command that opens a file).
- `DocumentService.saveAll`, the `code.format` RPC and `runtime.saveBeforePlay`.
- Built-in plugins in `plugins/*` are bundled into the editor build and run as dev plugins (hot reload) under `pnpm dev`.

For each plugin: requirements session → `docs/specs/<plugin>.md` → implementation → browser/e2e tests. The scopes below are baselines to discuss.

9.1 ✅ **settings-ui** (spec: `docs/specs/settings-ui.md`). Replaces the core Plugins panel.

- A modal dialog (_File › Settings…_, `Ctrl+Alt+S` or `Ctrl+,`): a category tree, search, and changes pending until Apply/OK.
- A scope menu and an inspect table per setting, with a reset per scope.
- Pages for plugins (enable/disable), import & export with a preview, and sync conflicts; the account sync status sits in the header.
- _Edit as JSON_ opens `settings.json` / `local.json` with a schema generated from every setting.
- Core additions: `PluginHostToken`, `AccountSyncToken`, and the `JSON_SCHEMAS` extension point (applied to Monaco by the code editor).
- Kit fixes found on the way: menus open above dialogs, dialog bodies scroll, splitters no longer stop mid-drag, and a restored code editor no longer takes focus from an open menu.

9.2 ✅ **history-panel** (spec: `docs/specs/history-panel.md`). Replaces the core History panel. It shows the focused history or all of them, lets you jump to any step, has grouped steps, previews of document edits, search and clear. Document histories (`file:*`, edits made through `DocumentService.edit`, e.g. Format and Organize imports) are kept in IndexedDB across reloads. The file manager runs its commands one at a time. Baseline scope before the session: a list of contexts with their entries, click to jump to a state, clear.

9.3 ✅ **code-editor** (spec: `docs/specs/code-editor.md`):

- The `Script` screen with Monaco and tabs.
- Registers Monaco models with `TextDocumentService`, loads project and `@nanoforge-dev` types, and shows diagnostics.
- Extension points for file-type editors and Monaco contributions.

9.4 ✅ **file-manager** (spec: `docs/specs/file-manager.md`). Replaces the core Files panel.

- `.nfignore` (optional, gitignore syntax) hides files from the whole editor: listings, watcher and code worker. The `@nanoforge/file-manager.exclude` setting hides files in the file manager only.
- `nf_modules/` is read-only on the server (the first `nf_modules` preparation hook), shown as a Packages section, and opened read-only by the code editor.
- Undoable operations: delete goes to the trash and `fs.restore` brings it back.
- `/files/<project>/<path>` serves thumbnails and downloads, and zips folders.
- `FILE_TEMPLATES`, `FILE_ACTIONS` and `FILE_ICONS` are in the SDK (`/ui`), so any plugin can contribute them.
- Baseline scope before the session:

- A dock tree plus a grid view of project files, with create/rename/delete/move and drag and drop.
- Open files with the editor registered for their type.
- Extension points for file actions, icons and "new file" templates.

9.5 ✅ **viewport** (spec: `docs/specs/viewport.md`). Replaces the core Game screen.

- The Game screen: resolution presets, zoom and pixel perfect, stats overlay, mute (engine `mute` command), screenshot, pop out. Play switches to it, focuses the game, and Stop goes back; _Maximize on play_ hides the docks; paused is dimmed.
- The Scene screen hosts `SCENE_EDITORS`; `VIEWPORT_TOOLS` and `VIEWPORT_OVERLAYS` are in the SDK.
- Play no longer opens a screen from the core. The layout controller has a temporary _hide docks_ state, and the project page provides the layout controller and workbench service to plugins.
- Baseline scope before the session:

- The `Game` screen hosts the client runner.
- The `Scene` screen hosts the `scene.editor` contribution selected for the current `codegen.target`, or an empty state.
- The `viewport.modes` and `viewport.overlays` extension points.

### Phase 10 — ECS plugin (`plugins/ecs`, requirements session first)

10.1 ✅ Requirements session (2026-09-27): `docs/specs/ecs.md`. Hierarchy, inspector, component/system browser, systems (run order, add/remove/reorder, enable/disable live) and live mode (client and server, runtime entities, viewport drag, manual _Apply to code_). Entities are named by their variable; code the editor can't model shows as read-only "from code" rows; an app/world selector picks the app (stopped) or the running instance (playing). Today the scene is `main.ts`; a future scene-manager lib and plugin will provide its own codegen target, so the widgets only go through `codegen.target`. Engine work goes in `../engine-editor-bridge`, rebased on `main`.

10.1b ✅ **Shared libraries** (ADR 0004): `type: "lib"` workspace members in `libs/*` hold components and systems shared by the apps (side per item), imported by package name through the root `tsconfig.json` `paths`. No publishing. The ECS plugin creates libs, creates items in them, and moves app items into them.

10.2 ✅ **Manifest** `requires: @nanoforge-dev/ecs`, and optional `@nanoforge-dev/graphics-2d` to enable 2D gizmos. `plugins/ecs` (`@nanoforge/ecs`): client entry (widgets, codegen target) and worker entry (item owner, analyzer, transformer); `contributes.itemOwner`; activation on its widgets and commands.

10.3 ✅ **Worker analyzer: discovery (ADR 0003).** Built: `packages/meta` (extractor: one-line TSDoc tags, TypeScript types to elements, enums, defaults, layout, owners with inference and claims), `CodeEngine.extractMeta` + root `tsconfig.json` `paths`, `CatalogService` (apps, shared libraries, `nf_modules` with `include`; cache reused while sources and owners are unchanged; waits for declared owners; lazy). The `@nanoforge/ecs` owner infers untagged pong components (`name` field in a components folder) and systems (functions in a systems folder), with queries and `ctx` uses. **Planned:** A new `@nanoforge-dev/editor-meta` package holds the extractor (core tags, TypeScript types, the owner-extension API). The code worker runs it for each provider (`nf_modules` via manifests and `include`, project packages, project apps) and keeps `.nanoforge/editor/cache/meta/` fresh (git-ignored). Core gets the catalog and the `contributes.itemOwner` manifest field. The ECS plugin registers the `@nanoforge/ecs` owner from its `entry.worker` (tags, claimed members, `extract`, schema), and exposes `ComponentRegistry`/`SystemRegistry` per app as views over the catalog, with diagnostics.

10.4 ✅ **Worker analyzer: entry file.** Golden tests on the pong fixture (`plugins/ecs/test`).

- Find the `main` export, the registry variable, the `spawnEntity` bindings, `addComponent(e, new X(...))` (object or positional args, mapped through the manifest's param order) and `addSystem(fn)`.
- Anything else becomes a `codeOnly` range.

10.5 ✅ **Worker transformers.** Also duplicate and move entities, move components and systems, `setArgs` filling defaults; imports merge into existing ones, by package name through `paths` (`moduleSpecifier`); untouched code stays byte-identical.

- Add or remove an entity (inserted after the last spawn, with a unique variable name).
- Rename an entity variable.
- Add or remove a component, set a param (edits only the literal), reorder.
- Add or remove a system, plus the imports each change needs.

10.6 ✅ **`codegen.target` provider "ecs.entry-file"** (priority 0). Edits go into `main.ts`'s own undo history; the panels point undo at it. Wires the analyzers and transformers to `CodegenTarget`, and each op is undoable through `FileEditCommand`.

10.7 **Widgets:**

- ✅ Hierarchy (entities, filter, drag to reorder, rename, duplicate, remove, read-only "from code" rows, app selector that sets `activeApp`).
- ✅ Inspector (components and params by `Element` type, enums as selects with their import, refs and non-literals as code), with the `ecs.fieldEditors` extension point.
- ✅ Systems panel (run order, drag to reorder, add from the catalog, remove, open the source).
- ✅ **Param layout** (spec: _Param layout_), from core TSDoc tags in the component's source (also `ecs.paramPresets`, and the _Component_ side panel through the code editor's `CODE_EDITOR_SIDE_PANELS`):
  - groups declared in the component header (`@group <Name> [color=…] [hidden] - <description>`), joined by params with `@group <Name>`: collapsible, with a colored name and an ⓘ for the description;
  - presets that merge a group's params into one control (`@preset vector.x` + `@preset vector.y` in group _Coords_ = one X/Y row named _Coords_); built in: `vector`, `size`, `color`; more through `ecs.paramPresets`;
  - per param: `@label` (display name), `@color` (color of its name), `@hidden` (hidden until chosen in the component's _Show hidden_ menu), and its description behind an ⓘ;
  - the meta carries them as core fields (`Element.layout`, `ItemMeta.groups`), so any owner plugin can use them;
  - the same settings are editable with controls on the **component's code page**: a _Component_ side panel next to the code (groups with name, description, color, hidden; per param: name, description, color, group, preset and slot, hidden; a live preview). It writes the TSDoc tags through a worker transformer, undoable like typing, and follows hand edits. Needs a `codeEditor.sidePanels` extension point in the code-editor plugin.
- ✅ Component and system browser (grouped App / Shared library / Installed package, search, details, add to entity or app, open in code, New component or system in the app or a shared library, New shared library, Move to shared library, Copy to…, one undo step each).
- ✅ An app context switch (client/server).

10.8 ✅ **Live mode** (during play):

- The hierarchy, inspector and systems panels show the world of the running client or server (engine `ecs-world` events, asked for with the `ecsWorld` feature; the ECS library records entities, components and systems in editor mode, and applies `ecs-set-component`, `ecs-add-component`, `ecs-remove-component`, `ecs-spawn-entity`, `ecs-remove-entity`, `ecs-set-system-enabled`).
- Live entities are linked to their variables by the call site of their `spawnEntity()`, matched to the spawn calls of `main` in the built bundle (the bundler keeps their order; `nf build --editor` makes no source maps). Others are runtime or "from code" entities.
- Edits change the running game; _Apply to code_ writes them (or the `@nanoforge/ecs.autoApply` setting); stopping with unapplied changes offers to apply them.
- ✅ **Drag in the Game screen** (2026-10-03): the _Move entities_ tool draws the client's entities over the running game (engine `viewport` feature) and drags them as live edits; graphics-2d's old drag was removed from the engine.
- ✅ **Scene screen: a 2D view drawn by the editor** from `main.ts` (positions from components with numeric `x`/`y`, graphics-2d `Rect`/`Circle` literals), live positions while playing. Selection follows the hierarchy; dragging writes the position to `main.ts`, or to the running game while playing. An engine "scene mode" was dropped: networked games (pong) wait for their server before drawing a frame.

10.9 ✅ **Tests:** golden round-trips on pong-network and a copy of engine/e2e/game (analyze → model snapshot; op → expected text, untouched code byte-identical), unit tests of the meta extractor, catalog, layout, docs and refactor transformers, bundle mapping under V8 and JSC, and browser tests (hierarchy, inspector, Component panel, shared libraries, 2D scene, live mode with the engine).

### Review fixes (browser review, 2026-10-01; phases 0–10 only) ✅

Found by walking the editor in Chrome, then fixed the same day. Phase 11 work (Console, Problems, palette, keymaps, inspectors, git, marketplace) was left out on purpose.

**Not covered by the review:** playing the game and live mode, file manager operations, dragging docks, a narrow window, ONLINE mode.

R1 ✅ **settings-ui: opening Settings threw `effect_update_depth_exceeded`**, again on each category click and search keystroke. The dialog's effect subscribed to stores that call back at once, and the callback bumped `revision` inside the effect: now in `untrack`.

R2 ✅ **e2e: page errors fail a test.** Specs import `test` from `e2e/test.ts`, whose automatic fixture fails a test on any uncaught error of its pages (`weberror`). Monaco's `Canceled` rejections are ignored. A racy assertion of the shared-library test now polls.

R3 ✅ **ui / ecs: names were cut before the details in tree rows** (`terr…`, `b`, no name for `paddle1`). In the kit `Tree`, the detail now only takes the room the label leaves. The Hierarchy's filter box goes under the app selector in a narrow dock instead of shrinking to nothing.

R4 ✅ **Scene screen: zoom, pan and fit.** Wheel zooms around the pointer (10 % to 1600 %), dragging the background or the middle button pans, _Fit_ shows the whole stage again; the stage has a 5 % margin so entities at `0,0` are whole.

R5 ✅ **Scene screen: undo follows a drag.** A pointer-down in the scene takes the focus, and the scene points undo at `main.ts` like the Hierarchy does. Scene editors now get the Scene screen's widget `instance` (`SceneEditor.component`).

R6 ✅ **ecs: _Open in code_ goes to the item.** `EcsService.openItem` opens the file at the item's `export` line, and the _Component_ side panel shows that component instead of the first one of the file.

R7 ✅ **settings: observers survive the removal of their definition.** When a plugin's settings are unregistered, observers keep their last value instead of throwing `Unknown setting` (and follow again when the plugin comes back).

R8 ✅ **settings: saving `local.json` after a change on disk.** Cause confirmed in the code: after a write conflict, the retry read the file through the `ProjectFs` cache, which is only invalidated when the watcher reports the change, so the three retries used the same old hash. The retry now asks for a fresh read (`ProjectFs.read(path, { fresh: true })`). Not re-checked with two live editors.

R9 ✅ **Server restart handling.** The re-list after a reconnection no longer rejects unhandled when the server lost the project. In dev, a hot update uninstalls the shared module registry before the next copy installs its own.

R10 ✅ **Home: recent projects.** Each entry has a _Remove … from the recent projects_ button (the server's `forget` was never called from the UI). Paths are cut at the start and have a tooltip, so two projects of one name can be told apart. A project outside the server's root still can't be opened from there: by design.

R11 ✅ **dev server: `plugins/.gitkeep` is no longer read as a dev plugin** (`vite.config.ts` only lists folders).

R12 ✅ **Settings: _Theme_ is a list of the installed themes**, and the category tree shows no current category during a search (picking one ends the search). _Language_ stays a text box: there is no list of locales yet.

R13 ✅ **Inspector.** A number field is marked invalid while its text isn't a number (it still goes back to the old value when left). A param shown as code has its full text as a tooltip; a larger editor for it is not built. The description box of the _Component_ side panel has a placeholder.

R14 ✅ **Hierarchy menu: _Rename_** (F2), which starts the same inline rename (`Tree` exports `rename(id)`).

R15 ✅ **Menus show a command's key even when its binding is inactive** (_Undo_ and _Redo_ had none while a text field had the focus): `KeybindingService.keyFor` falls back to the action's first binding.

R16 ✅ **ecs browser: `untagged`** now says what it means in its tooltip. The word stays.

R17 ✅ **Game screen: a crashed game offers _Show the console_** when the console plugin is there.

R18 ❌ **Light theme, dark _New_ button:** not reproduced, dropped. Buttons only use theme tokens; it was probably a transition frozen while the tab was hidden.

### Phase 11 — Extra plugins (a requirements session for each) ✅

11.1 ✅ **console + problems** (`plugins/console`, `@nanoforge/console`; spec `docs/specs/console.md`, requirements session 2026-10-01). Replaces the core Output panel.

- **Console:** every `LoggerService` entry, by source and group (Game, Build, Tasks, Editor, Plugins): group chips with counts, a Sources menu, level toggles, search, repeats merged with a count, logged values as expandable trees, links to project files (paths in the text, stack frames mapped through source maps, and where a game line was logged), copy, clear.
- **Problems:** `DiagnosticsService` grouped by file, severity and text filters, click to open at the position, whole-project check (`CodeService.checkProject()`, setting `@nanoforge/console.checkWholeProject`), build errors as problems, counts in the status bar.
- **Core:** `LogValue` and `serializeLogValue` in the kernel, `LogEntry.values`/`location`, `RuntimeService.sourceLocation` (source maps), build output and CLI tasks as runtime logs, `CodeDiagnostic.line`/`column`.
- **Other repos (unpushed):** engine `logs: { values: true }` (values and call site in log events), CLI `nf build --editor` writes linked source maps.
- **Not built:** structured values for the game server (its output is process text).

11.2 ✅ **command-palette + keymaps** (`plugins/command-palette`, `@nanoforge/command-palette`; spec `docs/specs/command-palette.md`, requirements session 2026-10-01).

- **Palette:** one box, the first character picks the search: `>` commands (`Ctrl+Shift+P`), nothing for files (`Ctrl+P`), `:` a line (`Ctrl+G`), `@` symbols of the open file (`Ctrl+Shift+O`). Fuzzy search with highlights, recent commands first, menu entries with arguments as actions (_View › Panels: Console_). It lists what was available where it was opened, and gives the focus back before running.
- **Keyboard shortcuts page** of Settings: every action with its shortcuts and their source, search, _Changed_ and _Conflicts_ filters, a recorder (chords, several shortcuts per action, a condition, conflict warnings with keep both or replace), remove, reset, presets (NanoForge, VS Code, Godot, and plugins' through `contributes.keymapPresets`), saved to the account or this machine.
- **Core:** keymap layers (defaults, preset, account, machine) with `resolveKeymap`, `setShortcut`, `findConflicts`, `KeybindingService.suspend()`; `listActions`; `CommandMetadata.palette`; the `SETTINGS_PAGES` extension point; `CodeService.symbols`; the `codeEditor.activeFile` context key.
- **Not built:** palette providers from plugins, symbols across the project.

11.3 ✅ **inspectors** (`plugins/inspectors`, `@nanoforge/inspectors`; spec `docs/specs/inspectors.md`, requirements session 2026-10-01). Three bottom-dock widgets, each asking the engine for its data only while shown, each with a Client / Server selector.

- **Profiler:** tick time chart (average and slowest per 250 ms window, two minutes), budget line and spike markers (`@nanoforge/inspectors.tickBudgetMs`), ticks per second, pause, hover or pin a window, Libraries and Systems tables for that window.
- **Network:** packet list with direction, transport and text filters, decoded payload (JSON or text) and hex dump, throughput charts from per-second totals, count of packets the engine left out.
- **World:** read-only tree of the running ECS world with a query (`Position`, `Position.x > 100`, `x > 5`, `#12`, `"text"`).
- **Core:** `EngineFeatures.ecsSystemStats` and `networkTrace.maxBytes`, merged by `mergeFeatures`; engine event types in the SDK.
- **Engine (unpushed):** ECS system timings (`ecs-system-stats`), network payload bytes and `network-stats` totals.
- **Not built:** recording and export, pausing or clearing the packet list, sampling controls. Packets sent before the first tick are not traced (the library wraps its transports on the first tick).

11.4 ✅ **git** (`plugins/git`, `@nanoforge/git`; spec `docs/specs/git.md`, requirements session 2026-10-01). Local editors only; gateway sync waits for the backend contract (phase 12).

- **Interface, after IntelliJ's:** a **VCS** menu (initialize, commit, update project, push, fetch, new branch, stash, log); a **Commit** panel on the left (changes and unversioned files with checkboxes, roll back, show diff, amend, commit and push, a Stash tab); a **Git** panel at the bottom (local and remote branches, the commits of a branch, a commit's details and files). Double-clicking a file opens its diff in the code editor.
- **Elsewhere:** branch and ahead/behind in the status bar; git status marks in the Files tree and grid.
- **Core:** `GitContract` and the `GitService` operations (the project folder's own repository only, never one above it); `codeEditor.compare`; the `FILE_DECORATIONS` extension point.
- **Not built:** hosted projects, a diff of two commits without the working file, a diff for deleted files, staging part of a file, rebase, tags, remotes management, credentials prompts.

11.5 ✅ **marketplace** (spec `docs/specs/marketplace.md`, ADR 0005, requirements session 2026-10-01). Runs on a stand-in registry read from a folder; the real one is phase 12.

- **Registry package** (`packages/registry`, `@nanoforge-dev/registry`, no editor dependency, meant to move to the CLI): the registry contract (`Registry`, `RegistryClient` over HTTP, `DirectoryRegistry` from a folder, `serveRegistry`), `installItem` (hash, manifest and path checks before anything is written, the manifest written last), `ProjectPackages` (`nanoforge.packages.json` and its lock, dependency resolution to one version per package, install, uninstall, update, restore, the root `tsconfig.json` paths).
- **Server:** `RegistryContract` (search, details, install and uninstall plugins for the user or a project, the project's packages); `REGISTRY_URL` and `REGISTRY_DIR`; a plugin's server entry starts on install and stops on uninstall. Installing is for local editors.
- **Plugins:** Settings › Plugins has two tabs, **Marketplace** (search, details, install _for me_ or _for this project_, update) and **Installed** (the former list, plus update and uninstall). Changes take effect after a reload.
- **Packages** (`plugins/packages`, `@nanoforge/packages`): _File › Packages…_, with **Browse** (search, dependencies, install) and **Installed** (update in range or to the latest, uninstall, restore after a fresh clone).
- **Not built:** the real registry and publishing, refusing installs on item-name collisions between two packages, engine libraries from the registry, the CLI's `nf install` on this format. The editor never edits the project's `.gitignore`.

11.6 ✅ **scene** (`plugins/scene`, `@nanoforge/scene`; spec `docs/specs/scene.md`, requirements session 2026-10-03). For apps using the engine's scene module (`@nanoforge-dev/scene`, engine branch `feat/scene`, worktree `../engine-scene`).

- **Engine:** `EcsScene` (`@nanoforge-dev/ecs/scene`): `setup(registry, ctx)` written like a `main`, on a tracked registry; entities and systems (removed by function) go at unload, components' `destroy()` is called. `SceneLibrary` takes `scenes` (ids that survive bundler renames) and sends the `scenes` bridge event (loaded chain, vars, known ids) with `scenes-load`, `scenes-unload`, `scenes-set-var` commands. Live entities carry their scene.
- **ECS plugin:** `ecs.sources` (what its widgets edit: a file and a function body), scoped entry analyzer and transformer, the parents' entities, systems and shapes read-only, live entities grouped by scene and applied to their scene's file.
- **Scenes panel:** the tree by `static parent`; new, rename (references, file, imports), move by drag and drop, set as initial, delete; selecting a scene makes the ECS widgets edit its `setup`. **Vars panel:** `SceneVars` in `scene-vars.ts`, uses, owners; add, rename (every key), edit, remove, declare. **Live:** loaded chain, _Load scene_ with params, _Unload scene_, live var values (editable), grouped live hierarchy.
- **Core:** `DocumentService.save(uri)`, `PromptOptions.optional`.
- `examples/breakout` is made of `EcsScene`s (`pnpm example breakout`); `e2e/scene.spec.ts` runs on a copy of it. Last full e2e run 73/73 (with `NANOFORGE_ENGINE=../engine-scene`).

### Phase 12 — Backend contract hand-off ✅

12.1 ✅ **`docs/api/`** (decisions taken with the user, 2026-10-02). The real API already has a registry (single-file components and systems, no versions): the contract describes the one the editor needs, without touching the API.

- `README.md`: the index, the calls the editor already makes (token refresh, projects), how features are turned on, how to run the contract tests.
- `registry.md`: routes after the npm registry's (one document per item with its versions, archives under `/-/`, search under `/-/v1/search`), read without a key; publishing with registry keys; what plugins carry (`engines.editor`, `build`); what changes from today's registry. `RegistryClient` and `serveRegistry` speak it.
- `settings-sync.md`: unchanged contract, plus the keys the editor reserves. The **account plugin list** is one of them (`plugins.account`), so it needs no endpoint: a plugin installed _for me_ is added to it, and a local editor that lacks one offers to install it. **Limit:** local editors do not sign in and keep the account document on their machine, so the list does not reach another machine yet (that needs sign-in for local editors: not built, to decide).
- **Per-user project settings of hosted editors** stay on the editor's disk (no endpoint): a hosted editor needs a persistent data volume.

12.2 ✅ **Contract tests.** One set of HTTP-only scenarios, two targets: the editor's stand-ins in every test run, a real API with `CONTRACT_*` variables (`pnpm --filter … test:contract`).

- API (`packages/server-core/test/contract`): authentication and token refresh, the project endpoints, settings sync (revisions, the 409 body, 400 and 413). They leave the test account's settings as they were.
- Registry (`packages/registry/test/contract`, read-only): the item document, the archive and its hash, search by text, type and page.
- Only run against the stand-ins so far.

12.3 ✅ **Feature flags.** `API_FEATURES` (an env list, nothing on by default): `settings`, `registry`.

- Without `settings`, a hosted editor keeps account settings on its own disk, and the Settings dialog says so.
- Without `registry` (and without `REGISTRY_URL` or `REGISTRY_DIR`), the registry is not called and the marketplace says it is not available. A registry without the search route is read the same way.
- `SessionInfo.features` tells the client (and plugins, through the SDK's `SessionContract`).

### Phase 13 — Docs & release ✅

13.1 ✅ **Plugin authoring guide** (`docs/docs/plugins/*`, ten pages): overview, a first plugin, manifest reference, SDK, extension points catalog, widgets and styles, settings, history, code and code generation, engine libraries.

- **`nf create plugin`** (CLI worktree `../cli-editor`, unpushed): `nf create plugin --name @scope/name` writes a working plugin (a panel, a command, a setting, an undoable action), outside of any project.
- **Example plugin**: `examples/counter-plugin`, a standalone folder, exactly what the command writes. Checked live in the e2e editor (`E2E_EXTRA_PLUGINS`): its panel, its command, undo.
- The SDK and the vite plugin are not on npm: the guide and `examples/README.md` say how to link them meanwhile.

13.2 ✅ **User docs** (`docs/docs/getting-started`, `docs/docs/editor`): introduction, first project, overview, layout, files, code editor, entities, components, systems, play, settings and shortcuts, Git, plugins and packages. New screenshots; the old pages and images are removed. `docs/docs/README.md` has the navigation to add to the docs site.

13.3 ✅ **Performance pass** (`docs/performance.md`).

- **Bundle**: the TypeScript compiler was in the page chunk (6.96 MB). It is now only in the code worker: the chunk is 65 KB. `ANALYZE=1 npx vite build` prints the heaviest modules and the import chain if it comes back.
- **Lazy plugins**: each plugin is its own bundle, loaded on its activation event; 394 KiB of plugin code at startup, Monaco only when a file opens.
- **Code worker cold start** on pong-network: 491 ms (budget 1.5 s), from marks in the performance timeline.
- **Layout**: a benchmark of the model (`pnpm --filter @nanoforge-dev/editor-layout bench`), and screen switches timed in the page (21 ms).
- `BENCH=1 npx playwright test` runs the startup measurements; they are not part of the tests.

13.4 ✅ Release `@nanoforge-dev/editor@1.0.0` and `@nanoforge-dev/editor-sdk@1.0.0`, with the changelog (do not release it in github or on pnpm, just write a CHANGELOG-v2.md). **Done:** `CHANGELOG-v2.md` at the root. Package versions are unchanged, nothing is tagged or published.

## Existing things to reuse or reference (not copy)

- Tooling configs: `eslint.config.*`, `.prettierrc`, `commitlint`, `.github/workflows/*`, `Dockerfile`, `pnpm-workspace.yaml` catalogs.
- Engine contracts:
  - `engine/packages/common/src/context/*` (RunOptions and ClientRunOptions);
  - `engine/modules/editor/src/*` (the editor-lib bridge);
  - `engine/modules/ecs/src/shared/editor-manifest.type.ts` (manifest types);
  - `@nanoforge-dev/config` `parseConfig`/`resolveConfig` (project discovery).
- Loader behaviour to mirror in the runtime:
  - how the files map is built and env prefixes are stripped: `loader/apps/website/src/index.ts`, `cli/src/action/actions/start.action.ts`;
  - server worker: `loader/apps/server/src/worker.ts`.
- Reference games for tests: `engine/example/pong-network`, `engine/e2e/game`.

## Verification

- **Unit (Vitest, node)**:
  - kernel: DI, extension points, dependency resolution, activation order, disposal leaves no leaks;
  - history: merge, transactions, limit, invalidation;
  - settings: scope precedence, 3-way merge, offline queue;
  - layout: op/serialize round-trip;
  - codegen: golden round-trip on pong-network, where an unchanged parse+print must be byte-identical and an edit must produce a minimal diff.
- **Browser tests (Vitest browser)**: widget style injection and scoping, the layout renderer, drag and drop between slots.
- **E2E (Playwright)**, open `engine/example/pong-network` with `nf editor`, then:
  1. Move and resize a dock, reload, and check the layout persists.
  2. Change a component value in the inspector; `apps/client/src/main.ts` changes minimally; Ctrl+Z restores the file.
  3. Switch to server context and edit a server entity.
  4. Play Server + Client: game renders, server logs stream, pause/stop work.
  5. Install a local-dev plugin that contributes a widget and a setting; it hot-reloads.
  6. Change a project-scope setting; `.nanoforge/editor/settings.json` is written.
- CI runs lint + unit + browser tests on each PR; e2e runs nightly and on release branches.
