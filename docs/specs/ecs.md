# ECS plugin (`@nanoforge/ecs`)

Requirements session: 2026-09-27. Built-in plugin in `plugins/ecs`, phase 10. It edits the entities, components and systems of each app, and shows the live world while the game runs. Items (components, systems) come from the catalog of ADR 0003.

## Manifest

- `engineLibs.required`: `@nanoforge-dev/ecs`. `engineLibs.optional`: `@nanoforge-dev/graphics-2d` (viewport drag).
- `contributes.itemOwner`: `{ "schema": 1, "tags": ["component", "system", "query", "uses"] }`. The plugin owns the `@nanoforge/ecs` key on items.
- `entry.client` (widgets, codegen target) and `entry.worker` (the owner extension, entry-file analyzers and transformers).

## Where the scene is written

- **Today: the app's `main.ts`**, as in pong-network: `registry.spawnEntity()`, `registry.addComponent(e, new X(...))`, `registry.addSystem(fn)` inside `main()`. This is the `codegen.target` provider `ecs.entry-file`.
- **Scenes** (2026-10-03, `docs/specs/scene.md`): the widgets edit a _location_, a file and the function body holding the spawns (`main`, or a scene's `setup`). The `ecs.sources` extension point gives it for an app (the highest priority that applies), with read-only locations shown with it (the scene's parents). Without a source, it is the app's `main`.
- Code the editor can't model (loops, helpers, conditions, entities built in other functions) is left untouched. Its entities show as **read-only "from code" rows**: greyed, with a lock, and _Open in code_ jumps to the lines.

## Which classes are components

- A class tagged `@component` (a function tagged `@system`) is one, anywhere.
- Untagged code is inferred too, so existing games work: an exported class of an app's or shared library's `dir.components` with a literal `name = "X"` field is a component; an exported function of `dir.systems` taking `(registry, ctx)` is a system. The browser marks inferred items with a hint to add the tag.
- Components used in `main.ts` (`new X(...)`) are resolved through TypeScript even when the catalog doesn't list them: their parameters come from their constructor.

## Scene screen

- The viewport's **Scene** screen shows the app's scene in **2D** (graphics-2d), whether the game is stopped or playing.
- The view is **drawn by the editor from `main.ts`**: each entity at the position of its component with numeric `x` and `y` params, with its graphics-2d `Rect` and `Circle` shapes written as literals. While playing, positions follow the live world. (A "scene mode" of the engine was dropped: networked games wait for their server before drawing a frame.)
- **Tools always work**: select a shape (it selects the entity in the hierarchy), and drag it. While stopped, a drag writes the entity's `Position` to code (undoable); while playing, it changes the live world (then _Apply to code_).
- The Scene screen is the ECS plugin's `SCENE_EDITORS` contribution for its codegen target. A scene-manager plugin can replace it.

## App and world selector

Other editors edit one shared scene and pick a running instance while playing (Unreal's World Outliner has a world selector; Godot's _Remote_ tree and Unity's play-mode hierarchy pick an instance). NanoForge's client and server are separate apps with their own `main.ts`, so:

- The hierarchy header has an **app / world selector**.
- **While stopped:** it picks the app whose code is edited (`client`, `server`…). It defaults to the active app.
- **While playing:** it picks the running instance whose live world is shown (the client game, the server game). It defaults to the instance being played.
- Components and systems offered for an app are the ones it can use: from the app itself, from shared libraries, from installed packages; with a matching `side` and the engine libraries they need.

## Hierarchy

- Entities of the selected app, named by their **variable name** (`const paddle1 = registry.spawnEntity()` shows `paddle1`).
- Add an entity (a unique variable name, inserted after the last spawn), remove one, rename (renames the variable), duplicate, reorder by drag, filter by name or component.
- "From code" rows are listed but can't be changed.
- While playing: **runtime entities** (spawned at runtime, not in code) are listed too, marked as such.

## Inspector

- The components of the selected entity, in `addComponent` order, each with its description from the meta.
- Add a component (a searchable picker over the catalog, filtered for the app and grouped like the browser), remove one, reorder.
- One field per constructor parameter, by `Element` type:
  - `string` (a select when it has `enum` or `enumRef`), `number`, `boolean`, `asset` (an asset picker filtered by `accept`), `array`, `object`;
  - `ref` (an engine object such as `Rect`): an editor contributed by the plugin for that lib through `ecs.fieldEditors`; otherwise the argument's code, editable as text;
  - `unknown`: the argument's code, editable as text.
- An edit changes only that argument's literal. Positional arguments follow the meta's parameter order. Missing trailing arguments show their defaults.
- While playing: values are live. An edit changes the running game only; **Apply to code** writes the entity's changed values (manual, see Live mode).

### Param layout: groups, presets, names, colors, hidden

The component's author controls how its params look in the inspector, with TSDoc in the component's source (core tags, see ADR 0003). Nothing changes at runtime.

```ts
/**
 * Where an entity is, in viewport pixels.
 *
 * @component
 * @group Coords color=#4aa3ff - Position from the top-left corner of the viewport.
 * @group Debug hidden - Values used while tuning the game.
 */
export class Position {
  name = 'Position';

  constructor(
    /** Distance from the left edge. @group Coords @preset vector.x */
    public x = 0,
    /** Distance from the top edge. @group Coords @preset vector.y */
    public y = 0,
    /** Draw order: higher is drawn on top. @label Layer @color orange */
    public z = 0,
    /** Draws the path the entity followed. @group Debug @hidden */
    public trail = false,
  ) {}
}
```

```
▾ Position                                          ⓘ  ⋯
  ▾ Coords ⓘ                                    (name in blue)
      X [ 960 ]   Y [ 540 ]                     (vector preset)
    Layer ⓘ [ 0 ]                               (name in orange)
    Show hidden (1) ▾                           → Debug
```

- **Groups** are declared in the component's header (the class doc): `@group <Name> [color=<css color>] [hidden] - <description>`. A param joins one with `@group <Name>`. A group used by a param but not declared in the header is created with no description. A group is a collapsible section, placed where its first param is, with its name, an ⓘ for its description, and its color.
- **Presets** combine the params of one group into one visual control. `@preset <preset>.<slot>` puts the param in a slot: two params with `vector.x` and `vector.y` in the group _Coords_ show as one X/Y row under the name _Coords_. `@preset <preset>` alone applies a one-param preset (a color picker). Built-in presets:
  - `vector` (slots `x`, `y`, `z`, `w`): the fields side by side, 2 to 4 of them;
  - `size` (slots `width`, `height`): the fields side by side, with a lock to keep the ratio;
  - `color`: a color picker for a string param; or slots `r`, `g`, `b`, `a` for number params.
  - Plugins add presets through the `ecs.paramPresets` extension point.
  - A preset whose slots are incomplete, repeated, or spread over several groups falls back to plain fields, with a warning on the component.
- **Name**: `@label <text>` replaces the param's name in the inspector (by default, the param name).
- **Description**: the param's doc text (inline doc, or `@param` in the constructor doc). It's shown behind an ⓘ next to the param's name. The component's and the group's descriptions have their own ⓘ.
- **Color**: `@color <css color>` colors the param's name; `color=` on a `@group` colors the group's name.
- **Hidden**: `@hidden` on a param, or `hidden` on a group, hides it by default. The component's _Show hidden (n)_ menu lists what's hidden; choosing one shows it. What's shown stays shown for that component in this project (a local, uncommitted editor state), and _Hide again_ in its ⋯ menu hides it.
- Params without layout tags show as today, in constructor order.

### Component page: editing the layout without writing tags

Everything above (name, description, color, preset, group, hidden) can also be set with controls, on the component's code page. The tags stay the source of truth: the controls write them.

- When a file that defines a component is open in the code editor, a **Component** side panel shows next to the code (a toggle in the editor's toolbar). _Edit layout_ in the inspector's ⋯ menu and in the browser opens the file with the panel.
- **Header**: the component's description (the class summary), editable, with its ⓘ preview.
- **Groups**: the list of groups, and **New group** with name, description, color picker and _Hidden_ toggle. Renaming a group renames every `@group` that joins it; deleting one leaves its params ungrouped.
- **Params**: one row per constructor param (and public field):
  - _Name_ (`@label`; empty = the param name);
  - _Description_ (the param's inline doc);
  - _Color_ (a color picker, with _None_);
  - _Group_ (a select of the groups, and _New group…_);
  - _Preset_ (a select of the presets, then of the preset's free slots: `vector` → `x`, `y`, `z`, `w`);
  - _Hidden_ (a toggle).
- **Preview**: the component as the inspector will show it, with its default values, updated as you edit.
- **Writing**: each change edits only the doc comments of the file (the header's `@group` lines and each param's inline doc), through an ECS worker transformer. It goes into the open document and the file's undo history, like typing. Editing the tags by hand updates the panel.
- Warnings (an incomplete preset, a tag on nothing) show in the panel and as diagnostics in the code.
- Components from installed packages open read-only: the panel shows their layout, disabled, with _Copy to…_.

## Components and systems browser

- Grouped under the words of ADR 0004: **App** _client_ (the selected app), each **Shared library**, then **Installed packages** (read-only, with a lock). Search, docs (description, params, example, query, uses), source.
- **New component** / **New system** ask where: the selected app (default) or a shared library. They create `<app or lib>/src/components/<name>.ts` or `…/src/systems/<name>.ts` from a template with the TSDoc tags (`@component` or `@system`, `@side`; `shared` by default in a shared library). The file opens in the code editor.
- **New shared library** (ADR 0004): creates `libs/<folder>/` with its `nanoforge.config.ts` (`type: "lib"`) and `package.json`, adds `libs/*` to the workspace and the package-name `paths` entry to the root `tsconfig.json`. One undoable step.
- _Open in code_, _Add to entity_ (components), _Add to app_ (systems). Using an item adds its import to `main.ts`: relative for the app's own items, by package name for shared libraries and installed packages (`@pong-network/shared/components/player`).
- **Move to shared library** on an app's item: moves the file into a shared library and rewrites every import in the project, one undoable step.
- **Copy to…** on an installed package's item: an undoable copy into an app or a shared library, imports updated.
- The ECS plugin warns when two items that the same app can use share a registry `name`.

## Systems

- The app's systems **in run order** (`addSystem` calls), with their query and uses from the meta.
- Add from the catalog (with its import), remove, **reorder by drag** (moves the `addSystem` calls).
- **While playing: enable / disable a system** to debug. It changes the running game only (an engine hook), and is reset on stop.

## Live mode

- Client and server games both have a live world, through the engine bridge. The selector picks which one is shown.
- The hierarchy and inspector show the live world (snapshots, then diffs at a sampled rate).
- Edits while playing change the running game only: set a component value, add or remove a component, spawn or remove an entity.
- **Apply to code** (per entity, and _Apply all_) writes live changes of entities that exist in code. Runtime entities can't be applied. The `@nanoforge/ecs.autoApply` setting applies every live edit to code as it happens (off by default).
- **Drag in the Scene screen**: while playing, dragging a shape changes its position in the running game, and Apply to code writes it.
- **Drag in the Game screen** (2026-10-03): the _Move entities_ tool of the Game toolbar outlines the client's entities over the running game (the engine's `viewport` feature maps game units to the frame) and a drag is the same live edit. While it is on, the game gets no pointer events.
- Stopping the game clears live changes that weren't applied. A notification offers to apply them first when some exist.

## Settings

| Key                         | Default | Meaning                                            |
| --------------------------- | ------- | -------------------------------------------------- |
| `@nanoforge/ecs.autoApply`  | `false` | Write every live edit to code as it happens.       |
| `@nanoforge/ecs.liveRateMs` | `100`   | How often the live world is sampled while playing. |

## Extension points (SDK)

- `ecs.fieldEditors`: `{ type, ref?, component }`, the inspector field for an `Element` type, or for one `ref` (`@nanoforge-dev/graphics-2d#Rect`).
- `ecs.entityActions`: extra actions on a hierarchy row (`{ id, title, command, when? }`).
- In the code editor (a new `codeEditor.sidePanels` point, see Core additions): the **Component** panel, shown when the active file defines a component.
- `ecs.paramPresets`: `{ id, slots?, component }`, a visual control combining the params of a group that use it (`vector`, `size` and `color` are built in).

## Core, SDK and engine additions

- **Core / SDK:**
  - The `@nanoforge-dev/editor-meta` package (extractor and owner-extension API) and the catalog, with `contributes.itemOwner` in the plugin manifest (ADR 0003, plan 10.3). Catalog providers: apps, shared libraries, installed packages.
  - Code editor: a `codeEditor.sidePanels` extension point (`{ id, title, icon, when, component }`, a collapsible panel beside the editor group, toggled from the editor toolbar) and a context key with the active file's path, so a plugin can show a panel for some files.
  - Shared libraries (ADR 0004): the code worker resolves the root `tsconfig.json` `paths`; the project service can create a lib and edit the workspace config and `paths`; the build orchestrator rebuilds the apps that import a changed lib.
  - The worker-side registration of owner extensions.
  - A way for the runtime service to forward ECS bridge messages to the plugin (live world, commands).
- **Engine** (in `../engine-editor-bridge`, **rebased on `main` first**; nothing pushed):
  - `ecs`: world snapshots and diffs (`world-snapshot`, `world-diff` events, sampled), commands `set-component`, `add-component`, `remove-component`, `spawn-entity`, `remove-entity`, `set-system-enabled`;
  - the link between a live entity and its code: in editor mode, the ECS library records where each `spawnEntity()` was called (a frame of the built bundle, `file:line:column`). The editor finds that call among the `spawnEntity()` calls of `main` in the bundle (the bundler keeps their order), which gives the variable in `main.ts`; entities spawned elsewhere are runtime entities. Engine only, no CLI change, no source maps (`nf build --editor` makes none);
  - ~~`graphics-2d`: drag of shapes while the editor asks for it~~: done by the editor instead, over the game, with the engine's `viewport` feature (`@nanoforge-dev/editor-lib`). graphics-2d's old `DrawableCircle2D`… drag was removed (engine `11f4c98`).

## Done when

- Golden round-trips on `engine/example/pong-network` and `engine/e2e/game`: analyze → model snapshot; each op → the expected diff; untouched code stays byte-identical.
- Browser tests:
  - the app selector switches the hierarchy between client and server;
  - add, rename, reorder and remove an entity, then undo;
  - add a component from the picker (the import is added), edit a number, a string enum and a `ref` as code, remove it;
  - the Component panel of a component file: create a group with a color, put `x` and `y` in it with the `vector` preset, label and hide a param; the source gets the matching tags, the preview and the inspector update, and one undo reverts one change;
  - a component with layout tags shows its groups (colored names, ⓘ descriptions), the `vector` preset as one row, labels and colors; a hidden param appears after choosing it in _Show hidden_ and stays shown after a reload;
  - "from code" rows are read-only and open the code;
  - create a component from the browser: the file has the TSDoc template and opens;
  - create a shared library, create a shared component in it, add it to an entity in both the client and the server app (package-name import), then move an app component into the library (imports rewritten), and undo;
  - add, reorder and remove a system;
  - while playing (with the engine): the live world shows runtime entities; a live edit changes the game only; Apply to code writes it; disabling a system stops it; a drag moves a shape and applies.
