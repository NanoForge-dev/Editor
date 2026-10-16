# NanoForge Editor 1.0.0

`@nanoforge-dev/editor@1.0.0` and `@nanoforge-dev/editor-sdk@1.0.0`.

The editor was rewritten from scratch. It keeps what the previous editor did (edit a NanoForge game in the browser, hosted or with `nf editor`) on a new base: everything visible is a plugin, the game's code is the only source of truth, and every change can be undone.

This file describes the release. Nothing is published yet: the package versions, the tag and the publication are the release steps still to do.

## What changes for you

### The game is its code

- The editor no longer keeps a save file of the scene (`.nanoforge/*.save.json`). Entities, components and systems are read from the app's `main.ts`, and written back to it when you change them in the panels.
- Code the editor cannot model (loops, helpers, conditions) is left untouched and shown read-only, with a link to its lines.
- Editing the code by hand and editing in the panels are the same thing: each follows the other.

### A workbench you arrange

- Four screens (Project, Scene, Script, Game) and panels in five docks. Drag tabs between docks, float them, close them, save layouts by name.
- A command palette (`Ctrl+Shift+P`) that also opens files (`Ctrl+P`), goes to a line (`Ctrl+G`) and to a symbol (`Ctrl+Shift+O`).
- Keyboard shortcuts you can change, with chords, conflict warnings, and the presets _VS Code_ and _Godot_.
- Light and dark themes.

### Undo everywhere

- Each area has its own history: each file, the Files panel, the layout, plugins. `Ctrl+Z` acts on what has focus.
- A History panel lists the steps, shows what each one changed, and jumps to any of them.
- File moves, renames and deletions can be undone. So can changes made from the panels to your code.

### Files

- A tree and a grid with image thumbnails; create from templates, rename, move, copy, duplicate, import by drop, download a folder as a `.zip`.
- `.nfignore` hides files from the whole editor.

### Code editor

- Monaco with the project's and the engine's types, go to definition into engine packages, rename, and errors for every file of the project in a Problems panel.
- Tabs and a split view. Unsaved changes survive a reload.
- Formatting with the project's own Prettier; save on delay or on focus loss; format and organize imports on save.
- A banner when a file with unsaved changes was modified on disk, with a side-by-side comparison.

### Entities, components and systems

- A Hierarchy and an Inspector per app (client, server), and a 2D Scene screen where entities are selected and dragged.
- A Components panel listing what an app can use: its own, shared libraries, installed packages. Create components and systems from templates.
- **Shared libraries**: code used by both the client and the server, imported by package name; move a component into one with its imports rewritten.
- The **Project screen** manages the project: add, rename and remove client apps, server apps and shared libraries, and choose which apps use each library.
- The author of a component chooses how it shows in the inspector (groups, presets such as vectors and colors, labels, hidden parameters) with documentation tags, or with the Component panel beside the code.
- Systems of an app listed in run order, reordered by drag.

### Play

- Play, pause, step, restart and stop, for the client, the server or both; a second client in another window.
- A Game screen with resolutions and device presets, zoom, a stats overlay, mute, screenshots, and a pop-out window.
- **Live mode**: while the game runs, the Hierarchy and the Inspector show the running world. Change values, add components, spawn entities, switch systems off; _Apply to code_ writes what you want to keep. Move entities by dragging them in the Scene screen, or over the running game with **Move entities** in the Game screen.
- A Console for the game, builds and the editor: logged objects expand, file paths are links, and game lines show where they were logged, through source maps.
- A Profiler (tick time, time per library and per system), a Network panel (packets, decoded payloads, throughput) and a World panel (the running entities, with a search).

### Git

- A VCS menu, a Commit panel (changes, unversioned files, rollback, amend, stash) and a Git panel (branches, commits, changed files), after IntelliJ's.
- Push with a preview of the commits, update, fetch, branches; file status marks in the Files panel; the branch in the status bar.
- Local editors only.

### Settings

- One dialog with search. Each setting can be saved to your account, this machine, the project (committed) or the project for you only.
- Import and export; the project's settings as a JSON file with completion.
- Account settings sync between devices once the API offers it (see below).

### Plugins and packages

- **Plugins** extend the editor. Install them from _Settings › Plugins_, for yourself or for a project.
- **Packages** bring components, systems and assets to a game. Install them from _File › Packages…_; they go to `nf_modules`, with a list and a lock file in the project.
- Both read a registry that the API does not provide yet: until then the marketplace says it is not available (a folder can stand in for it).

### Scenes

For games built on the engine's scene module (`@nanoforge-dev/scene`, engine branch `feat/scene`), a new built-in plugin:

- the **Scenes** panel: the scene tree by parent, new, rename, move by drag and drop, set as initial, delete; selecting a scene makes the Hierarchy, Inspector, Systems and Scene screen edit its `setup`, with its parents' entities and systems read-only;
- the **Vars** panel: the scene vars declared in `scene-vars.ts`, their uses and the scenes that make them; add, rename (every key follows), edit, remove, declare a key used in code;
- while playing: the loaded scenes, _Load scene_ (with its params) and _Unload scene_, live var values, and the live entities grouped by scene.

The `examples/breakout` project is a game made of scenes (`pnpm example breakout`).

## For plugin authors

- The ECS plugin's `ecs.sources` extension point: what its widgets edit for an app (a file and the function holding the spawns), and read-only locations shown with it.
- `DocumentService.save(uri)`, and `PromptOptions.optional`.

- `@nanoforge-dev/editor-sdk` is the only package a plugin imports: services, commands, settings, history, code analysis, the runtime, and the editor's own components and theme.
- `nf create plugin --name @scope/name` writes a working plugin; `DEV_PLUGINS` loads it in the editor with hot reload.
- Extension points for panels, screens, menus, shortcuts, the status bar and toolbar, settings pages, themes, file templates, file actions, document editors, code generation targets, scene editors, game overlays, and inspector fields.
- A plugin can run code in the code worker (analyzers, transformers, item owners) and in the editor's server.
- The guide is in `docs/docs/plugins`, and a reference plugin in `examples/counter-plugin`.

## Breaking changes

- **Projects saved by the previous editor** as `.nanoforge/*.save.json` are not read. Their entities must be in `main.ts`. No importer is provided.
- **The previous editor's plugins and settings** do not carry over.
- **Engine**: play controls, stats, live mode and the inspectors need NanoForge engine 2.0 or later, and the game registers its editor library (`app.use(new EditorLibrary())`, from `@nanoforge-dev/editor-lib`). The editor offers to add it. A game without it still plays, without them.
- **`nf editor <path>`** opens a project directly; without a path it lists recent projects.
- **Hosted editors** never build or run project code, and do not install plugins or packages.

## Operating a hosted editor

- `API_FEATURES` lists what the API offers (`settings`, `registry`). It is empty by default: account settings then stay on the editor's disk, and no registry is called.
- A hosted editor needs a persistent data volume (settings, and per-user project settings).
- What the editor asks of the API is in `docs/api`, with contract tests the API team can run.

## Performance

- The editor's page script went from 7 MB to 65 KB: the TypeScript compiler now loads only in the code worker.
- The code worker is ready about half a second after it is first needed on the pong-network example.
- Plugins load when first used; the code editor (Monaco) only when a file is opened.

Measurements and how to reproduce them: `docs/performance.md`.

## Known limits

- The registry of plugins and packages, account settings sync, and the list of plugins following you between machines wait for the API (`docs/api`).
- Dragging entities inside the Game screen is not built (drag them in the Scene screen).
- The Git graph is a straight line per branch; no rebase, tags, cherry-pick or staging of part of a file.
- No debugger or breakpoints.
- The SDK and the plugin build tool are not on npm yet: plugin projects link them from the editor repository.
