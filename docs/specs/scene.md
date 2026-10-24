# Scene plugin (`@nanoforge/scene`)

Requirements session: 2026-10-03. Built-in plugin in `plugins/scene`. It edits the scenes of the apps that use the engine's scene module (`@nanoforge-dev/scene`, engine branch `feat/scene`): their tree, their entities and systems (through the ECS plugin's widgets), the scene vars, and the loaded scenes while the game runs.

## Engine side

The scene module stays ECS-agnostic (scenes are `load` / `unload` hooks). What the editor edits is written with an ECS scene base class.

### `EcsScene` (`@nanoforge-dev/ecs/scene`)

An extra entry of the ECS module, with `@nanoforge-dev/scene` as an optional peer dependency.

```ts
/**
 * First level: the bricks.
 *
 * @scene
 * @side client
 * @vars bricksLeft, served
 */
export class Level1 extends EcsScene<{ seed: number }> {
  static override parent = Run;

  override setup(registry: Registry, ctx: Context, { params }: SceneLoadContext<{ seed: number }>) {
    const wall = registry.spawnEntity();
    registry.addComponent(wall, new Position(40, 90));
    registry.addComponent(wall, new Box(1200, 26));
    registry.addSystem(levelFlow);
    ctx.scenes.vars.init('served', false);
  }
}
```

- `setup(registry, ctx, scene)` is written like an app's `main` (each scene its own `setup`, spawns written out: a `setup` inherited from a base class, or spawns in a loop, show read-only): `const x = registry.spawnEntity()`, `registry.addComponent(x, new C(...))`, `registry.addSystem(fn)`. The ECS plugin edits it the same way.
- `registry` is the app's registry, tracked: the entities spawned and the systems added through it are removed when the scene is unloaded (deepest scene first, so its systems are the last ones added). A component with a `destroy()` method gets it called when its entity is removed this way (a component holding a graphics shape destroys it).
- `teardown(registry, ctx)` (optional) runs before that cleanup.
- System removal: the ECS keeps, on the JS side, the list of the functions passed to `addSystem`, so a scene removes its systems by function (the registry's own `removeSystem` takes an index).
- In editor mode, each entity spawned by a scene carries the scene's id in the live world (`EditorWorld` entity `scene`), and its call site is the line of `setup` that spawned it (not the tracked registry's wrapper).

### `SceneLibrary` options

```ts
app.use(
  new SceneLibrary({
    initial: Menu,
    scenes: { Menu, Run, Level1, Level2, Pause },
  }),
);
```

- `initial`: the scene loaded at the first tick. **Set as initial scene** in the editor writes it.
- `scenes` (new): every scene class of the app, keyed by its **id**. The keys are the ids everywhere (the bridge's `scenes` event and commands, the live entities' `scene` field): a bundler can rename a class (`Sprite` → `Sprite2`), never the key of `{ Menu }`. A scene missing from the map falls back to its class `.name`. The plugin keeps the map in step when it creates, renames or deletes a scene.

### Editor bridge (scene module, editor-aware like sound/music)

- Feature `scenes` (asked with `useFeatures` while the Scenes or Vars panel is on screen; added to `mergeFeatures`).
- Event `scenes`, sent when something changed: the loaded chain (`[{ id, params }]`, root first), the vars (`{ key, value, owner?, persistent }`) and the known ids. Values are the JSON view of the live world (`{ $class, …fields }` for class instances), not the console's `LogValue`: editor-lib does not expose the host's serializer to libraries.
- Commands: `scenes-load` (`name`, `params`, `parent?`), `scenes-unload` (`name`), `scenes-set-var` (`key`, JSON value).

## Which apps

Any app (client or server) whose `package.json` depends on `@nanoforge-dev/scene`. The ECS plugin's app selector picks the app. Other apps keep editing `main.ts`.

## How the plugin plugs into the ECS widgets

The ECS widgets (Hierarchy, Inspector, Systems, the Scene screen, the browser's _Add to entity_ / _Add to app_) edit a **location**: a file and the function body holding the spawns. Today it is always the app's `main`. The ECS plugin gets an extension point, `ecs.sources`:

```ts
interface EcsSource {
  id: string;
  priority: number; // highest wins for an app
  appliesTo(app: AppModel): boolean;
  /** What the widgets edit now: `{ path, scope: { class, method: 'setup' } }`, or the app's `main`. */
  current(app: AppModel): Observable<EcsLocation | undefined>;
  /** Read-only locations shown under the current one: the parents of the edited scene. */
  inherited(app: AppModel): Observable<readonly InheritedLocation[]>;
}
```

- The ECS entry analyzer and transformer take the scope (`main`, or a class's method); everything else in them is unchanged.
- The Scenes panel's selection sets the scene plugin's `current`. Its first row is the app's `main.ts`: selected by default (no scene selected), the ECS widgets then edit `main` as in an app without scenes.
- `main`'s entities and systems are in the game whatever scene is loaded: while a scene is edited, they are the outermost inherited location (read-only, _Edit this scene_ goes back to `main.ts`).
- **Inherited content**: the entities of the selected scene's parents show in the Hierarchy under their scene's name, greyed and read-only (_Open in code_, _Edit this scene_), and in the Scene screen (dimmed, not draggable). The Systems panel lists the parents' systems above, read-only, in run order.
- _Add to app_ on a system becomes _Add to scene_ while a scene is edited.

## Scenes panel

A widget (`scene.scenes`, left dock, next to the Hierarchy).

- The scenes of the selected app as a tree, by `static parent`. Scenes without a parent are roots; the initial scene has a mark. A scene in the list whose file is gone, or a scene class missing from `scenes`, shows a warning with a fix.
- A scene is: an exported class extending `Scene` (or `EcsScene`) in the app's `dir.scenes` (default `src/scenes`), or anywhere with `@scene`. Untagged ones get the "add the tag" hint, like components.
- Row: name, params (`{ seed: number }`, from the type argument, docs in a tooltip), `@vars`, side.
- Actions:
  - **New scene…** (and _New scene under X…_): a name. Writes `<dir.scenes>/<kebab-name>.ts`, an `EcsScene` from a template with the TSDoc tags (a plain `Scene` is written by hand), adds it to `scenes` in `main.ts`, opens it. One undoable step.
  - **Rename**: the class, its file, its imports, `static parent` references, `scenes` and `initial`.
  - **Delete**: the file (or the class, when the file holds others) and its entry in `scenes`; children of a deleted scene lose their parent. No confirmation: it is one undo step, and a notification names the children and offers _Undo_. Other code using the class is left as it is. The initial scene can't be deleted.
  - **Re-parent by drag** (onto another scene, or to the root): writes `static parent` and its import.
  - **Set as initial scene**: writes `initial` in `main.ts`.
  - **Open in code**; **Edit** (select: the ECS widgets now edit it).
- A scene that is not an `EcsScene` (or whose `setup` the editor can't model) is listed, and the ECS widgets show its spawns read-only, like "from code" rows.

## Vars panel

A widget (`scene.vars`, bottom or right dock).

- The vars of the selected app, from `src/scene-vars.ts`:

  ```ts
  declare module '@nanoforge-dev/scene' {
    interface SceneVars {
      /** Points of the current game. @default 0 */
      score: number;
    }
  }
  ```

- Row: name, type, default (`@default`), description, and **where it is used**: the scenes that `init` it (its possible owners), and the files that `set` / `get` / `has` / `remove` it (string-literal keys of `ctx.scenes.vars.*` calls), each a link. A key used in code but not declared shows a warning with _Declare_; a declared var used nowhere is greyed.
- **Add var** (name, type, default, description), **rename** (the declaration and every string-literal use), **remove** (the declaration; warns if used), edit the type, default and description. Each is one undoable step on `scene-vars.ts` (and the files using it, for a rename). The file is created on the first var.
- **While playing**: each var's live value (the `LogValue` tree), its owner scene, and _persistent_; the value is editable (a live edit: `scenes-set-var`). Vars that exist only at runtime are listed too.

## Live mode

- **Scenes panel**: the loaded chain is highlighted (current scene bold), with their params. Context menu: **Load scene** (a form for its params, by type: number, string, boolean, JSON otherwise; and _Load under the current scene_ for a scene without a parent) and **Unload scene** (a loaded one). They act on the running game only.
- **Hierarchy (ECS), while playing**: the live entities grouped under the loaded scenes (`Run › Level1 › Pause`), then the entities of `main` and the runtime ones. _Apply to code_ writes into the file of the scene that spawned the entity (the engine's `scene` field, and the call site matched among the `spawnEntity()` of that scene's `setup` in the bundle).
- The selector picks client or server like today.

## Settings

None in the first version.

## As built (2026-10-03)

- Tree operations (new, rename, move, initial, delete) and var changes are steps of one undo context, _Scenes_ (`scene:tree`), the Scenes and Vars panels' history. A step made of several file changes computes each change on the result of the previous one, and saves the files it changed at once (`DocumentService.save`): a file open in the code editor is changed as a document, never written behind it.
- Rename moves the file only when it is named after the class and holds nothing else; imports are rewritten (the ECS plugin's `ecs.importers` and `ecs.rewrite-imports`) before the file moves.
- Prompts ask one value at a time (`PromptOptions.optional` for the optional ones: a var's default and description, optional params).
- The scenes panel follows the ECS plugin's app selector (the `activeApp` context key).
- Not built yet:
  - a fix action for "X is not in the scenes of SceneLibrary" (the warning is listed under the tree);
  - scene rows show the params type, not `@vars` and side, and have no tooltip for the params' docs;
  - the selected scene is not kept across reloads;
  - _New scene_ writes an `EcsScene` only.
- Tested in e2e: the tree, editing a scene (entity, component, system, undo), the parents read-only, new / rename / drag / move to the root / initial / delete with undo, the vars (add, rename, remove, declare), and live mode (loaded chain, _Load scene_, live vars, grouped live entities, _Apply to code_ into the right scene).

## Core, SDK, ECS plugin and engine changes

- **Engine** (`../engine-scene`, `feat/scene`): `EcsScene` and the tracked registry in `@nanoforge-dev/ecs/scene`; by-function system removal; the `scene` field of live entities; `SceneLibrary`'s `scenes` option; the scene module's bridge feature (`scenes` event and commands), editor-lib as an optional peer.
- **Protocol / runtime** (editor): the `scenes` feature in the protocol types and `mergeFeatures`.
- **ECS plugin**: the `ecs.sources` extension point; scope in the entry analyzer and transformer; inherited rows in the Hierarchy, Systems and Scene screen; live entities grouped by scene; bundle spawns matched per scene class.
- **Scene plugin**: the `@nanoforge/scene` item owner (tags `scene`, `vars`), analyzers (the app's scenes, `main.ts`'s `SceneLibrary` options, the vars and their uses) and transformers (scene files, `main.ts`, `scene-vars.ts`, var renames), the two widgets, the `ecs.sources` contribution, live state.

## Done when

- Golden tests: the scene analyzer on the breakout example (tree, params, vars, uses); each transformer's diff (new scene, rename, delete, re-parent, set initial, add/rename/remove var); the ECS entry analyzer and transformer on an `EcsScene.setup` body.
- Engine unit tests: `EcsScene` cleanup (entities, systems by function, `destroy()`), the bridge feature (event when changed, the three commands).
- Breakout rewritten with `EcsScene` (and the `scenes` map), each level with its own `setup` and its bricks written out, still playable; an e2e copy of it.
- Browser tests on that copy:
  - the Scenes panel shows the tree; selecting `Level1` makes the Hierarchy show its bricks and `Run`'s entities greyed;
  - add an entity and a component to `Level1`, add a system: the scene file changes, undo reverts it;
  - new scene under `Run`, rename it, re-parent it by drag, set it as initial, delete it, with undo;
  - add, rename and remove a var: `scene-vars.ts` and the uses change;
  - while playing: the loaded chain is highlighted; Load scene `Level2` moves the game; the Vars panel shows `score` live and an edit changes it; the Hierarchy groups live entities by scene.
