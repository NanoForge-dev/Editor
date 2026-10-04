# NanoForge Editor v2 — notes for agents

The NanoForge editor, rewritten from scratch. The full plan, with status per phase, is `docs/rewrite-plan.md`. Specs per plugin are in `docs/specs/`, design decisions in `docs/adr/`. Read the plan section of the phase you work on before touching code.

## Working rules

- **Where to work.**
  - This is the worktree `G-EIP-600/editor-v2`, branch `rewrite/v2`.
  - Never commit on the user's own branches or checkouts (`G-EIP-600/editor`, `engine`, `loader`, `cli`): use a worktree.
  - Never push or publish. That is the user's call.
- **Phases.**
  - The user advances phases explicitly ("move to phase N"). Don't start the next phase on your own.
  - Plugins (phases 9–11) always start with a **requirements session**: ask the user, write `docs/specs/<plugin>.md`, then build.
  - When a phase item is done, mark it ✅ in `docs/rewrite-plan.md` with a short summary of what was built.
- **Open questions** (see "Open design questions" below):
  - the `nf_modules` dependency model (install, imports, collisions: see ADR 0003's open questions).

  Ask the user before building anything that depends on them.

- **Repository standards follow the engine** (`../engine`, `origin/main`):
  - `package.json` fields in the engine's order (`$schema`, `name`, `version`, `description`, `keywords`, `homepage`, `bugs`, `license`, `contributors`, `files`, `main`, `module`, `types`, `exports`, `type`, `directories`, `repository`, `funding`, `scripts`, `dependencies`, `peerDependencies`, `devDependencies`, `packageManager`, `engines`, `private`, `publishConfig`, `lint-staged`), dependencies sorted, Node 26 and pnpm 12;
  - every workspace has the engine's `README.md` (badges, About, Links, Contributing, Help), `LICENSE` and `.prettierignore`; published ones (`apps/editor`, `packages/sdk`, `tooling/vite-plugin`) also `CHANGELOG.md`, `cliff.toml` and `.cliff-jumperrc.json`;
  - each workspace has a `<group>:<name>` label (`.github/labels.yml`, `labeler.yml`, `issue-labeler.yml`) and a choice in the issue forms. A new workspace gets all of them;
  - the editor keeps single quotes (its Prettier override of the engine config).
- **Commits.**
  - Conventional commits, with the package or plugin name as scope: `feat(settings-ui): …`, `fix(ui): …`.
  - Commitlint rejects sentence case, and a subject starting with an acronym such as "JSON" counts as sentence case: write "json".
  - End the message with the `Co-Authored-By` line.
  - Split work into logical commits: core/SDK changes first, then the plugin.
  - Husky runs Prettier and ESLint on staged files.
- **Shell.**
  - `cp` is aliased interactive: use `command cp -f`.
  - Never `pkill -f` (it matches and kills its own shell): kill by PID.
  - zsh doesn't word-split `$var`: use `${=var}` in loops.
  - The shell cwd resets after each command: `cd` inside each command.
- **Ports.**
  - 5174 is the user's own dev server: don't touch it. Use `EDITOR_API_PORT` for another dev server.
  - The e2e tests use port 4790.

## Commands

```sh
pnpm install
pnpm turbo build --filter=@nanoforge-dev/editor...   # editor + every package and plugin it bundles
pnpm lint          # prettier --check . + eslint in every package
pnpm typecheck
CHROME=/usr/bin/google-chrome-stable pnpm test       # unit + Vitest browser tests (packages/ui needs CHROME)
pnpm dev           # editor + built-in plugins in watch mode (hot reload)

# E2E: against the production build. Build first, and rebuild after every change.
cd apps/editor
CHROME=/usr/bin/google-chrome-stable \
NANOFORGE_ENGINE=/home/exelo/workspace/epitech/G6/G-EIP-600/engine-editor-bridge \
NANOFORGE_CLI=/home/exelo/workspace/epitech/G6/G-EIP-600/cli-editor \
npx playwright test [spec…] --reporter=line
```

- **Run e2e with `E2E_WORKSPACE=.workspace-agent`** (any folder name under `e2e/`). The default `e2e/.workspace` is wiped at each run, and the user's dev server (`FS_ROOT=apps/editor`) may have its projects open. Specs take their paths from `e2e/workspace.ts`.
- Without `NANOFORGE_ENGINE`, the tests that play the game (runtime, the viewport's "while playing", some code-editor tests) are **skipped**, not failed. Check the skipped count.
- `NANOFORGE_CLI` (a built CLI checkout) is linked into the played game as its own CLI. Without it, the console test skips its source-map check (the game's published CLI writes no source maps).
- Contract tests (`test/contract` in `server-core` and `registry`) run in `pnpm test` against the stand-ins, and against a real API with `CONTRACT_*` variables (`docs/api/README.md`). Never run them against a real API yourself.
- `ANALYZE=1 npx vite build` (in `apps/editor`) prints the bundle analysis; `BENCH=1 npx playwright test` runs the startup measurements of `e2e/*.bench.ts` instead of the tests (`docs/performance.md`).
- `E2E_EXTRA_PLUGINS=<built plugin folder>` adds a dev plugin to the e2e editor.
- SDK public API snapshot: after adding SDK exports, run `cd packages/sdk && npx vitest run -u`, and check that the diff shows only what you added.
- E2E specs import `test` and `expect` from `./test` (`e2e/test.ts`), not from `@playwright/test`: its fixture fails a test when a page throws an uncaught error. Known noise goes in its `IGNORED` list.
- To debug a failed e2e test, read `test-results/<test>/error-context.md`. For a screenshot, unzip `trace.zip` and open the last frame in `screencast/`.
- The CLI repo needs `pnpm --filter @nanoforge-dev/config build` before `pnpm build`.

## Architecture in one screen

- **Monorepo:** pnpm + turbo. The app is a SvelteKit static SPA plus a Bun server, in Svelte 5 with runes only. Schemas use zod v4.
- `apps/editor`:
  - the shell (routes `/`, `/load?path=|gatewayId=`, `/project/[id]`, `/play`);
  - the server (`scripts/build-server.ts` bundles `dist/`, including `dist/plugins`);
  - the e2e tests.
- **`packages/*`** are source-only (`exports` → `src/index.ts`). Only `sdk` is really built.
  - `kernel`: DI (`createToken`, `Container`), `Disposable`, `Emitter`, `ObservableValue`, extension points, commands, context keys / `when`, plugin and package manifest schemas, resolver, `PluginHost` (`PluginHostToken`; `update()` swaps the plugin set when a project opens or closes).
  - `sdk`: **the only package plugins import**: `@nanoforge-dev/editor-sdk`, plus `@nanoforge-dev/editor-sdk/ui`.
  - `settings`: scopes default < account < machine < project < projectLocal; `AccountSyncStore` (`AccountSyncToken`).
  - `history`: per-context stacks, `goTo`, serialization, IndexedDB persistence of `file:*` contexts.
  - `layout`: a pure layout model and its operations.
  - `ui`: the kit (bits-ui), theme tokens, workbench renderer, extension points.
  - `code`: code worker, `DocumentService`, `JSON_SCHEMAS`.
  - `runtime`: build, client runner, server runner.
  - `protocol`: the engine bridge protocol, and the RPC contracts between the editor and its server.
  - `rpc`, `project`, `server-core` (fs, `.nfignore`, `nf_modules` read-only, plugin sources and package suggestions, git, cli, registry contract).
  - `registry` (`@nanoforge-dev/registry`, **not** an `editor-*` package): registry client, folder registry, installer, the project's packages list and lock. It is meant to move to the CLI repository: ESLint keeps `@nanoforge-dev/editor-*` imports out of it. Its HTTP side follows the npm registry's routes (`src/wire/`, contract in `docs/api/registry.md`). Protocol imports only its `/types` (zod schemas, no Node code).
- **`plugins/*`** are the built-in plugins, each with a `nanoforge.manifest.json` of `type: "plugin"`:
  - `code-editor` (Monaco)
  - `file-manager`
  - `viewport` (Game and Scene screens)
  - `history-panel`
  - `settings-ui`
  - `ecs`
  - `console` (Console and Problems panels)
  - `command-palette` (the palette, and the Keyboard shortcuts page of Settings)
  - `inspectors` (Profiler, Network and World panels)
  - `git` (the VCS menu, the Commit and Git panels after IntelliJ's, status bar branch, file status marks)
  - `packages` (the Packages dialog, _File › Packages…_; the plugin marketplace is in `settings-ui`)
  - `scene` (the Scenes and Vars panels, for apps with `@nanoforge-dev/scene`; spec `docs/specs/scene.md`). It plugs into the ECS widgets through `ecs.sources`: they edit the selected scene's `setup` instead of `main`
- **`tooling/`**:
  - `vite-plugin`: builds plugins;
  - `example-plugin`: `@acme/hello`, the dev plugin loaded by the e2e tests;
  - `spike-plugin`.
- **`examples/pong-game`**: a game project to try the editor on. `pnpm example` (`scripts/example.mjs`) links its engine libraries from `NANOFORGE_ENGINE` (default `../engine-editor-bridge`) and starts the built editor on port 4800 with `FS_ROOT=examples`. It has a shared library (`libs/shared`, `@pong-game/shared`). The ECS scene test has its own trimmed copy (`plugins/ecs/test/fixtures/pong-game`).
- **`examples/breakout`**: a client-only game made of scenes (`@nanoforge-dev/scene`, engine branch `feat/scene`): `NANOFORGE_ENGINE=../engine-scene pnpm example breakout`. Its entities and systems all belong to scenes (`GameScene`), so the Scene screen and Hierarchy show none: use Play and the World panel.
- **`examples/counter-plugin`**: a standalone plugin, outside the workspace, as `nf create plugin` writes it (the CLI command is in `../cli-editor`).
- **`docs/docs`**: the user documentation and the plugin authoring guide (Mintlify pages, copied to the docs site).

### Manifests: packages and plugins (ADR 0003)

Everything in our registry has a `nanoforge.manifest.json` and a name `@scope/name`. There are two types, and they never mix: a package never holds a plugin.

- **`type: "package"`** (schema: `PackageManifestSchema` in kernel; full draft in `docs/drafts/item-schema.ts`):
  - installed in `<project>/nf_modules/@scope/name`, read-only;
  - `items`: source files whose exports are items (components, systems…), documented with TSDoc;
  - `include`: sub-folders holding their own `package` manifest. Walk it, never scan folders. Includes stay inside the package (no `..`), 4 levels max;
  - `suggestedPlugins`: `["@scope/name"]` or `{ "@scope/name": "^1.0.0" }`. When a project opens, the editor names the missing ones in a notification (`plugins.suggestions`);
  - `libDependencies` (engine libs), `dependencies` (other packages), `npmDependencies`.
- **`type: "plugin"`** (schema: `PluginManifestSchema`, JSON schema `packages/kernel/schemas/plugin.schema.json`, regenerate with `pnpm --filter @nanoforge-dev/editor-kernel generate:schema`). Plugin sources, later ones shadowing earlier ones with the same name:

  | Source      | Where                                                                     | Loaded                     |
  | ----------- | ------------------------------------------------------------------------- | -------------------------- |
  | `bundled`   | `apps/editor/dist/plugins/@scope/name` (built-in plugins)                 | always                     |
  | `installed` | `~/.nanoforge/editor/plugins/@scope/name`                                 | in every project           |
  | `project`   | `<project>/.nanoforge/plugins/@scope/name`, URL `/plugins/project/<id>/…` | while that project is open |
  | `dev`       | local folders (`<path>/dist`), hot reloaded                               | always                     |

  A project plugin's server entry only runs in a local editor, never in a hosted one.

- **Items** (components, systems…) never have a lib-specific type. Lib data goes in owner objects keyed by the owner plugin's name: `"@nanoforge/ecs": { "type": "component" }`. Only that plugin parses it. Core formats (manifest, item, element) must stay lib-agnostic.
- **Shared libraries** (ADR 0004): `libs/<name>` workspace members of `type: "lib"` (no manifest, never published) hold components and systems shared by client and server; side is per item. Apps import them by package name (`@pong-network/shared/components/player`) through the root `tsconfig.json` `paths`; installed packages the same way. An app **uses** a library when its `nanoforge.config` `libs` lists it (paths relative to the app, the CLI's field; `AppModel.libraries`). Every change also writes the app's `package.json` dependency; when they disagree `libs` wins and the project shows a warning. A library nobody mentions goes to every app. `libs` are never engine libraries (those come from `package.json`), and is only offered the items of the libraries it uses. The Project screen manages apps and libraries through `packages/project/src/workspace/` (add, rename, remove, "Used by"; one undo step each, history context `project`). In the UI say **Shared library**, **Installed package** and **Engine library**, never a bare "lib".
- **Meta** of items is generated by the editor into `.nanoforge/editor/cache/meta/`, never published, never written next to sources. (Planned for phase 10.3.)
- The CLI (`nf install`, `nf publish`) still uses `scope/name` and the old types: ignore it until the user asks.

### Plugin mechanics (ADR 0001)

- **Build.** Plugins are built with `tooling/vite-plugin`: `base: './'`, and shared modules (the Svelte runtime and the SDK) are rewritten to `globalThis.__nanoforge_editor_shared__.require(...)`. Plugins **must be in runes mode**.
- **CSS.** CSS is extracted to `<name>.css` (`build.lib.cssFileName`). Load it in `activate()` with `context.resolveAsset(...)` + `StyleServiceToken.inject(context.name, css)`.
- **Settings keys** from the manifest are prefixed with the plugin name, e.g. `@nanoforge/viewport.maximizeOnPlay`.
- **Adding a built-in plugin:**
  1. copy the layout of an existing plugin (`package.json` with `build`/`dev`/`lint`/`typecheck`, `vite.config.ts`, `svelte.config.js`, `tsconfig.json`, manifest, `README.md`, `LICENSE`, `.prettierignore`);
  2. add it as a devDependency of `apps/editor` (it is then bundled and run as a dev plugin);
  3. its name is accepted as a commit scope automatically.
- **Plugins only import the SDK** (ESLint enforces it). If a plugin needs something from core, export it from the SDK: add a token in the owning package, provide it in `apps/editor/src/lib/editor/create-editor.ts`, re-export it, and update the snapshot.
- **Dialogs from a plugin:** mount a Svelte component with `mount`/`unmount` from a command (see `plugins/settings-ui/src/index.ts`).

### Engine bridge (protocol v1)

- **The game registers it** (engine 2.0 and later): `app.use(new EditorLibrary())` from `@nanoforge-dev/editor-lib` (engine `modules/editor`). The engine's own examples don't: the e2e `game` copy and `pnpm example` link the library from `NANOFORGE_ENGINE` and add it (`scripts/engine-bridge.mjs`). A game without it plays with no bridge, and the editor offers **Add the editor library** (`addEditorLibrary` in `packages/project/src/workspace/editor-library.ts`).
- **The hello comes in the game's first tick**, after its `main` returned: the runtime waits for it a little (`helloTimeoutMs`, 1.5 s) before calling a game bridgeless, and re-checks on a late hello. The runtime tests' fake game (`server-core/test/fixtures/runtime/bridge-game.js`) greets the same way.
- **The engine sends `ecs-world` only when the world changed**: `RuntimeService.lastWorlds()` keeps the last one per game, for views that start listening while the game is paused.
- **Handshake:** `hello` → `welcome`, with features `frameStats`, `logs` (`{ values: true }` adds the logged values and the call site to `log` events), `networkTrace`, `ecsWorld` and `viewport` (the client's `ViewportState`: how game units map to its container, for drawing over the game).
- **Messages:**
  - commands: `pause`, `resume`, `step`, `stop`, `mute`;
  - event: `state`.
- **Events plugins read** (`RuntimeService.onEvent`), each sent only when its feature is asked for with `useFeatures`: `frame-stats`, `ecs-world`, `ecs-system-stats` (`ecsSystemStats`), `network-trace` and `network-stats` (`networkTrace`, with `maxBytes` for payload bytes), `viewport`. A new feature also goes in `mergeFeatures`, or it is silently dropped. Ask while a view is on screen (`WidgetInstance.visible`: a tab shown once stays mounted while hidden), not from activation: `mergeFeatures` takes the most demanding request.
- The engine's `EditorBridge` (`modules/editor/src/internal/editor-bridge.ts`) buffers the game's console output until `welcome`. The runtime service checks compatibility (legacy, older or newer engine).
- **Logs:** everything shown in the Console goes through `LoggerService`. The source name gives the group: `game:client`, `game:server`, `build:<app>`, `cli:<command>`, a plugin's name, anything else is the editor. Logged values use the `LogValue` tree, made by kernel `serializeLogValue` only: the client runner hands it to the game (`RunOptions.editor.serializeLogValue`), and the engine calls it when a line is logged. The engine has no serializer of its own.
- **Moving entities in the Game screen** (ECS plugin, `GameMoveOverlay.svelte`): the _Move entities_ tool (`ecs.moveInGame`) draws the scene shapes of the client's live entities over the game with the `viewport` mapping, and a drag is a live edit (`live.setField`), like the Scene's. graphics-2d's old drag (`DrawableCircle2D`… emitting `move-component`) was removed from the engine (`11f4c98`, breaking).
- **Unpushed branches in other repos:**

  | Repo   | Branch                                                                                                                                     | Worktree                  |
  | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
  | engine | `feat/core-editor-bridge` (one commit on engine 2.0.0, rebased by the user 2026-10-02; old base in `backup/core-editor-bridge-pre-rebase`) | `../engine-editor-bridge` |
  | loader | `feat/server-editor-ipc`                                                                                                                   | `../loader-editor`        |
  | cli    | `feat/editor-open-project` (`nf editor [path] --port`, `nf create plugin`)                                                                 | `../cli-editor`           |
  | engine | `feat/scene` (`modules/scene`, `@nanoforge-dev/scene`; from `feat/core-editor-bridge`)                                                     | `../engine-scene`         |

## Conventions that matter

- **Source layout (ADR 0006, after the engine and the CLI):**
  - `src/` holds `index.ts` and kebab-case feature folders, each with its own `index.ts` in packages (none in plugins);
  - files are named after their main export, with kind suffixes (`.type.ts`, `.enum.ts`, `.exception.ts`, `.const.ts`), and `<variant>.<kind>.ts` for implementations (`memory.scope-store.ts`);
  - tests go in `test/` mirroring `src/`, as `*.spec.ts`, with shared helpers in `test/fixtures/`;
  - Svelte files are kebab-case when an `index.ts` re-exports them, PascalCase otherwise;
  - split a file past about 300 lines (a Svelte file's `<style>` not counted); state a split component held stays owned above any `{#if}` its parts sit under;
  - dialogs are opened by an `open-<name>-dialog.ts` next to them; a code worker entry is `src/worker/index.ts`.

- **Comments:** no `//` or `<!-- -->` comments in the code, only `/** */` doc comments and tool directives (`eslint-disable`, `svelte-ignore`, `@ts-expect-error`, `prettier-ignore`). An empty `catch {}` is allowed (ESLint `allowEmptyCatch`).
- **UI text:** sentence case, plain verbs, and a button says what it does. Accessible names are how the e2e tests find things (`getByRole`), so give every control a label.
- **Svelte 5:**
  - Props read once (dialogs mounted once) need `// svelte-ignore state_referenced_locally`.
  - Wrap reads inside effects that also write state in `untrack` (to avoid "effect update depth exceeded").
  - Plain values that change outside Svelte are made reactive with a `revision` counter bumped by subscriptions, read with `void revision` in `$derived.by`.
  - Lint wants `SvelteSet`/`SvelteMap` for mutable collections. For a throwaway copy, disable `svelte/prefer-svelte-reactivity` on that line.
- **Docks (IntelliJ tool windows):** six slots (`bottom` is the bottom row's left part, `bottomRight` its right part). Their panels are icons in the left and right stripes (`ToolStripe.svelte`), and a docked stack shows only the active panel's header. Clicking the icon of a shown panel **hides its slot**: in e2e, use `showPanel`/`panelTab` (`e2e/helpers.ts`), never a bare click on a panel's tab. Floats keep a tab strip. A dock's icon shows before its plugin activates: built-in widget icons live in the kit (`icons.ts`).
- **Kit z-order:** dock 10 < float 100 < dialog 2000 < menu 2500 < toast 3000. Menus, selects and tooltips must open above dialogs.
- **Menus:** checked menu entries are plain `menuitem`s with a check icon (no `menuitemcheckbox` role).
- **Actions and shortcuts:**
  - An _action_ is a command with its arguments (`actionId`). The palette and the keymap page list `listActions`: titled commands, plus menu entries that give arguments.
  - A command that needs arguments sets `palette: false` (in `commands.register` or in the manifest), or it shows in the palette and does nothing.
  - Write default shortcuts with `Mod` (Ctrl, or Cmd on macOS). The keymap is layered: `KEYBINDINGS`, the preset, the account's `keymap.overrides`, this machine's. Edit lists with `setShortcut`, never by hand.
  - The kit's `Select` trigger is a `button` named by its label (not a `combobox`): `getByRole('button', { name: 'Preset' })`.

## Pitfalls already paid for

- **Monaco:**
  - Reuse existing models (`modelFor`), or you get "Cannot add model".
  - Use TS `moduleResolution` Bundler (100) so `@nanoforge-dev/*` types resolve.
  - Only `editor.focus()` when focus is free (body or inside the editor group), or a tab restored after a reload closes the menu the user just opened.
- **Splitters / pointer drags:** call `preventDefault()` on pointerdown. Otherwise Chrome fires `pointercancel` after the first move whenever the page has a selection.
- **Git:**
  - Every git command runs with `GIT_CEILING_DIRECTORIES` set to the parent of the project folder, and a project is a repository only if it has its own `.git`. The e2e project lives inside this repository: without that, a test would stage or commit the editor's own files.
  - The e2e git test creates its repository, a bare remote and a second clone under `e2e/.workspace`, and removes them before and after.
  - No default shortcut for an action that publishes (`Push`): shortcuts are caught before Monaco, and `Ctrl+Shift+K` is its "delete line".
  - A renamed file is two paths (`path` and `from`): commit and roll back both, or half of the rename stays staged.
  - Don't bind a single-stroke default that starts a chord (`Mod+K`): it hides `Mod+K S` and every user chord starting with it. `Commit…` has no default shortcut for that reason.
  - The editor writes `.nanoforge/editor/.gitignore` in a project: it shows as an untracked file. Assert on a specific file, not on a count of changes.
  - In a repository, tree rows of the Files panel end with a mark (`scratch •`): `expandFolders` (exact names) does not find them.
- **Stores updated in place and Svelte:** a `$derived` that returns the same object or array does not update what reads it. A store that plain code mutates (the inspectors' recorder) must hand views new arrays or a copy per revision.
- **A test that fails while the game plays** leaves the game server running, and the next test's server then exits at once. Stop the game in an `afterEach` (see `e2e/inspectors.spec.ts`), and read the first failure, not the cascade.
- **Overlays you mount yourself** (the palette): move the focus out of the overlay before removing it from the page. Removing the focused element leaves Chrome sending no key events to the page until the next click.
- **Dialogs:** the kit dialog is a flex column with `max-height: 70vh`, and its body scrolls. Size big dialog content to `calc(70vh - 120px)`.
- **Account scope in tests:**
  - Account settings are kept by the editor server across e2e tests (the data dir outlives browser contexts), and are pushed with a 500 ms debounce. A test that ends right after writing loses the push, and the next test sees stale values.
  - In tests, write to _This machine_ (per browser context), or restore the value and wait for "Account synced".
  - The Project scope writes `e2e/.workspace/pong/.nanoforge/editor/settings.json`: clean it up.
- **E2E state leaks:**
  - Tests share `e2e/.workspace` (a pong copy prepared by `e2e/prepare-workspace.mjs`) and the saved layout. Start with `resetLayout(page)`, and use `expandFolders` (both in `e2e/helpers.ts`).
  - If a test passes alone but fails in the full run, bisect by running pairs of specs.
  - A test that writes `.nanoforge/plugins` or `nf_modules` in the pong copy must remove them (`afterEach`, see `e2e/project-plugins.spec.ts`).
  - The e2e server reads its registry from `<workspace>/.registry` (`REGISTRY_DIR`, written by `prepare-workspace.mjs`). A test that publishes a version there, installs a user plugin (`.data/plugins`) or a package (`nanoforge.packages*.json`, `tsconfig.json` paths) puts everything back (see `e2e/marketplace.spec.ts`).
  - `nanoforge.manifest.json` is a build input of turbo (it was not until 2026-10-01: a manifest-only change kept the old bundle).
  - After changing a plugin manifest, rebuild it: `tooling/example-plugin` is not rebuilt by the editor build filter (`pnpm --filter @nanoforge-dev/editor-example-plugin build`).
- **Installing folders and the file watcher:** a folder that appears through a rename is missed by the server's watcher (its content never reaches the client's file list, so the catalog does not see a new package). `installItem` writes files in place, the manifest last.
- **API features:** nothing of the NanoForge API beyond sign-in and projects is called unless listed in `API_FEATURES` (`settings`, `registry`). The real API (`../api`, read-only for us) has neither yet; its current registry is another shape (`docs/api/registry.md`).
- **Account plugin list:** `plugins.account` is an account setting, and a local editor's account document lives on its own machine (no sign-in): the list does not travel between machines yet. Don't describe it as cross-machine.
- **Account plugin list in e2e:** installing a plugin _for me_ writes `plugins.account` in the account settings, which outlive tests. A test that installs one uninstalls it through the page (see `e2e/marketplace.spec.ts`), or the next tests get a sticky "not installed here" notification.
- **The compiler stays in the worker:** main-thread code must not import `@nanoforge-dev/editor-code/engine` or the main entry of `@nanoforge-dev/editor-meta` for values (use `@nanoforge-dev/editor-meta/pure`). One such import puts ts-morph and TypeScript (7 MB) in the page chunk; `ANALYZE=1` shows the chain.
- **Scenes:**
  - The ECS finds a component by its class name: a component named like a class the bundle already has (graphics-2d's `Sprite`) is renamed by the bundler (`Sprite2`) and no longer matches its `name` field. Scene ids come from `SceneLibrary`'s `scenes` keys for the same reason.
  - A scene's `static parent` is read when its module is evaluated: the parent's module must not import its children (breakout's `run.ts` imports no scene).
  - Edits to a file open in the code editor change the open document, saved later: a multi-file operation saves what it changed (`DocumentService.save`), and never writes a file behind an open document (the document then can't be saved).
  - E2E: `scene.spec.ts` runs on a breakout copy (`e2e/<workspace>/breakout`), made only when `NANOFORGE_ENGINE` has a built `modules/scene` (`../engine-scene`). It snapshots and restores the client's sources.
- **Docs follow the code:** `docs/docs` (user docs, plugin guide) cite labels, shortcuts and APIs. After changing one, grep the docs for it.
- **Diagnostics of several apps:** each app with its own `node_modules` gets its engine types (asked per app, not once per package) and its own TypeScript program for diagnostics (`CodeEngine._checked`). One program for client and server made the client's type augmentations (`ctx.network`) apply to the server: false errors in Problems. Analyzers and transformers still use the single `project`.
- **Manual passes find what e2e does not** (2026-10-02, by driving Chrome through screenshots): binary files opened as text, a tab lost on rename, tabs cut off in a dock, `nf new` waiting on a prompt. Their regressions are in `e2e/manual-pass.spec.ts`.
  - `nf new` asks for everything it is not given, and the server has no terminal: pass every option (`--package-manager`, `--strict`…).
  - The focus context keys are set in a microtask after `focusin`/`focusout`, never during it: focus moves while Svelte renders, and subscribers that set component state would throw `state_unsafe_mutation`.
  - In `matchesGlob`, `**/` is folders only. As `.*` it made the dotfile pattern match every file with an extension.
  - A game server's stderr is a warning unless it reads like an error; blank output lines are dropped.
- **Inspector on documented components:** the ⓘ tooltips need a bits-ui `Tooltip.Provider`; the kit's `Tooltip` brings its own, because plugin widgets are mounted outside of any provider. The scene places an entity by a component named like a position, not by the first one with `x` and `y` (a `Velocity` has them too).
- **Formatting:** each workspace runs its own Prettier (`lint`, `format`, its `lint-staged`) with its own `.prettierignore`; the root one skips `apps/`, `packages/`, `plugins/` and `tooling/`. A folder Prettier must not touch (test fixtures: golden tests compare their text) goes in that workspace's `.prettierignore`.
- **Doc comments:** TypeScript counts a comment right after `(` or `,` as that token's trailing comment. Read param docs with `leadingDocComments` (editor-meta), not ts-morph's `getLeadingCommentRanges`.
- **Worker mirror:** it follows document changes asynchronously. `CodeService.analyze`/`transform` mirror the file's current text first; code that talks to the engine directly must too.
- **Saved layout and widget state in e2e:** they outlive a test (server-side, saved after 500 ms). A test that changes tabs or expands folders resets them at the end and waits before the page closes (see `e2e/ecs.spec.ts`).
- **Plugin activation order changes timing:** adding an `onStartup` plugin delays the others, which exposed focus races. Test the full suite after adding one.
- **Workspace changes (Project screen):**
  - The project is discovered again as soon as a `nanoforge.config.ts` or a `package.json` name changes, before the rest of an operation is written. Write what makes the change visible **last** (the workspace `packages`, the library's own name), and in e2e poll the files that follow a card.
  - A screen with no focusable content loses the undo target when its background is clicked: the Project screen's root has `tabindex="-1"`.
  - The e2e `pong` project has no `node_modules` (type errors, failing builds): never assert "No problems" there. `game` is the playable copy.
- **Runtime:**
  - Legacy engines without the bridge need the runner to send `{type:'started'}` after `main()`.
  - In Bun, use the global `process` for IPC (a namespace import breaks it).
  - The server worker exits on `disconnect`.
- **CLI:** `nf` delegates to the CLI installed in the project (`<cwd>/node_modules/@nanoforge-dev/cli/dist`), so `NF_CLI_PATH` does not change which build code runs for such a project.
- **Console filters and `e2e`:** the Console's group, source and level filters are widget state (saved server-side). A test that changes them puts them back and waits 900 ms.
- **File manager:**
  - Fast repeated commands race: they run through a serialized queue.
  - After a drag and drop, focus goes back to the tree (`refocus`), so Ctrl+Z reaches the Files history rather than the layout.

## Status (2026-10-02)

| Phase | Status                                                                                                                                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–7   | Done                                                                                                                                                                                                                         |
| 8     | Done, except the ECS/graphics-2d engine hooks (8.2/8.4), moved to after the ECS requirements session. 8.7 became "open a project directly": `nf editor <path>` and `/load`                                                   |
| 9     | Done: all five built-in plugins. Then: `@scope/name`, `plugin`/`package` split, project plugins, suggested plugins; last full e2e run 35/35                                                                                  |
| 10    | Done: meta extractor and catalog, ECS plugin (hierarchy, inspector, param layout, Component panel, browser, systems, shared libraries, live mode, 2D scene), except dragging inside the Game screen; last full e2e run 44/44 |
| 11    | Done: console + problems, command palette + keyboard shortcuts, inspectors, git (after IntelliJ's windows, VCS menu), marketplace (plugins in Settings, Packages dialog, on a folder registry); last full e2e run 60/60      |
| 12    | Done: `docs/api/` hand-off (registry after npm's routes, settings sync, account plugin list as a settings key), contract tests (stand-ins and `CONTRACT_*` targets), `API_FEATURES` flags; last full e2e run 60/60           |
| 13    | Done: plugin guide and `nf create plugin`, user docs, performance pass (compiler out of the page bundle), `CHANGELOG-v2.md`. Not released: versions unchanged, nothing tagged or published                                   |

### Open design questions (ask the user)

1. **Items (decided, ADR 0003).** See "Manifests: packages and plugins" above. Still open there: engine libs shipping items, inspector value hints, headless meta generation (imports, collisions, the packages list and sub-packages were settled by ADR 0004 and 0005).
2. **`nf_modules` / install (decided, ADR 0005).** The editor server installs packages read-only into `nf_modules/@scope/name`, side by side, one version each, from `nanoforge.packages.json` and its lock; plugins go to `~/.nanoforge/editor/plugins` or `<project>/.nanoforge/plugins`. To change a package, the user copies it into their own components.
   - The editor treats `nf_modules` as read-only (server, file manager, code editor): installing is the only way to change it.
   - Discovery goes through a catalog with providers (project packages and apps, `nf_modules`), never folder scans.
   - Still open: the real registry (contract handed off in `docs/api/registry.md`; the editor runs on a folder with `REGISTRY_DIR`, and calls the API's only with `API_FEATURES=registry`), whether engine libs stay on npm, moving `packages/registry` to the CLI and aligning `nf install` with it. Don't touch the CLI's install code until the user asks.
