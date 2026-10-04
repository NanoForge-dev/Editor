# ADR 0003 — Items: TSDoc in the source, editor-generated meta, owner-keyed data

- Status: accepted (2026-09-27). The field-level schema is a draft and may change.
- Schema: `docs/drafts/item-schema.ts` (zod, every value commented)
- Visual summary: https://claude.ai/artifact/RNu5aEEUCBcPodtAnbtdNJ
- Example: `engine/example/pong-network/nf_modules/@nanoforge/` and its
  `.nanoforge/editor/cache/meta/`

## Context

The editor needs to know, for each thing a package provides (today: ECS components and systems):
its name, what it does, its parameters (types, defaults), which side it runs on, and the data a
specific lib needs (for ECS: the registry name, the components a system queries, the `ctx` libs it
uses).

The previous plan read `EDITOR_COMPONENT_MANIFEST` / `EDITOR_SYSTEM_MANIFEST` literals
(`engine/modules/ecs/src/shared/editor-manifest.type.ts`). They duplicate the code and drift from it.

Dependencies will be packages installed in the read-only `nf_modules/`. The editor must read them
without scanning folders.

What the real code forces:

- Components are classes with **positional constructors** (`new Velocity(x, y)`) and a
  `name = "X"` field that the ECS registry keys on.
- Parameters can be **engine objects** (`Rect`, `Circle` from graphics-2d) or **engine enums**
  (`InputEnum`), not just primitives.
- Client and server sets differ: every item has a **side**.

## Decision

### Names

Every name in our registry is `@scope/name`, like a scoped npm package: packages, editor plugins,
owner keys, and the prefix of plugin settings (`@nanoforge/viewport.zoom`). The editor enforces it
(`PLUGIN_NAME_PATTERN`). The CLI is not changed yet.

### One shape at every level

The manifest, each item, and each element (a parameter or a field) have three parts:

1. **Core fields**, understood by the editor with no plugin: names, source, description,
   TypeScript types, `side`.
2. **`requires`**: the npm libs needed to use it (manifest: `libDependencies`, `npmDependencies`;
   item: the libs its source imports; element: implied by `ref` / `enumRef`).
3. **Owner objects**: extra keys named after an editor plugin (`"@nanoforge/ecs": { … }`). Only that
   plugin parses them. Core fields never contain `/`, so they can't clash with owner keys, and any
   other unknown key is an error.

Nothing in the core is shaped for one lib. There is no `component` or `system` type: an ECS
component is an item with `"@nanoforge/ecs": { "type": "component", "name": "Position" }`.

The core never looks inside an owner object. An item whose owner plugin isn't installed stays in
the catalog as a generic item.

### Manifests

`nanoforge.manifest.json`:

- `type`: `package` or `plugin`. The two are separate: a package never holds a plugin.
- `items`: source files, relative to the manifest, whose exports can be items.
- `include`: sub-folders holding their own `package` manifest. The catalog walks `include`, it
  never scans. An include must stay inside the package (no `..`, no absolute path), and nesting
  stops at 4 levels.
- `suggestedPlugins`: editor plugins that make the package easier to use, as `["@scope/name"]` or
  `{ "@scope/name": "^1.0.0" }`.
- `dependencies` (our registry), `libDependencies`, `npmDependencies`, `publish` as before.
- Owner objects for package-level data.

**Where things are installed.**

| What     | Where                                          | Loaded                     |
| -------- | ---------------------------------------------- | -------------------------- |
| Packages | `<project>/nf_modules/@scope/name` (read-only) | by the catalog             |
| Plugins  | `~/.nanoforge/editor/plugins/@scope/name`      | in every project           |
| Plugins  | `<project>/.nanoforge/plugins/@scope/name`     | while that project is open |

A project's plugin shadows the same plugin installed in the home folder (then come dev plugins).
Its server entry only runs in a local editor: a hosted editor never runs project code on the
server.

**Suggested plugins.** When a project opens, the editor collects the `suggestedPlugins` of the
packages in `nf_modules` (following `include`) and names the ones that aren't installed in a
notification, once per project. Installing is manual for now.

An editor plugin that owns a key declares it in its manifest, so the editor can suggest it when it
meets one of its tags:

```json
"contributes": { "itemOwner": { "schema": 1, "tags": ["component", "system", "query", "uses"] } }
```

### Docs are TSDoc in the source

The `.ts` file is the only source of truth.

- **Core tags:** the summary, `@remarks`, `@param`, `@example`, `@side client|server|shared`
  (default `shared`), `@asset [param] [.ext…]`, `@deprecated`, `@internal`.
- **Core layout tags** (how params look in the inspector, see `docs/specs/ecs.md`, _Param layout_):
  on the item, `@group <Name> [color=<css>] [hidden] - <description>`; on a param (its inline doc,
  or a field's doc), `@group <Name>`, `@preset <preset>[.<slot>]`, `@label <text>`, `@color <css>`,
  `@hidden`. They are core, not owner tags: any owner plugin's inspector can use them.
- **Owner tags** are declared by the owner plugin and read only by it. `@nanoforge/ecs` declares
  `@component`, `@system`, and `@query` / `@uses` (overrides when the analyzer can't infer them).
  Two installed plugins claiming the same tag is an error that names both.
- **Inferred from code:** types, defaults, optional, string literal unions (`enum`), enum types
  (`enumRef`), lib classes (`ref`), imports (`requires`). The ECS plugin infers the registry `name`,
  `query` (each `registry.getZipper([...])`) and `uses` (each `ctx.<lib>`).
- An owner **claims** members it describes itself, which are then left out of `params` / `fields`:
  ECS claims a component's `name` field and a system's `(registry, ctx)` parameters.

An export is an item when it's in a file listed in `items`, or, in the project's apps (no manifest),
when an owner tag is on it.

### Elements

Core types describe TypeScript, not a lib: `string` (`enum`, `enumRef`), `number`, `boolean`,
`asset` (a project file path, `accept`), `array` (`items`), `object` (`properties`), `ref`
(`"@nanoforge-dev/graphics-2d#Rect"`), `unknown` (`tsType`, edited as code). The default is
`default` when it's a JSON value, `defaultCode` (source text) otherwise. A `ref` is edited by the
plugin that contributes an editor for it; otherwise it's shown as code.

### The editor generates the meta, into its cache only

Owner data can only come from owner plugins, and they run in the editor. So the editor is the
only producer of metadata:

- **Extraction runs in the code worker**, in its own package (`@nanoforge-dev/editor-meta`) so it
  can later run without the UI. The core extractor produces the core parts; each owner plugin
  registers, from its `entry.worker`, its key, tags, claimed members, a zod schema and `extract()`.
- **The meta lives only in `.nanoforge/editor/cache/meta/`** (git-ignored), one file per source:
  `modules/@scope/name.json` (`nf_modules`), `packages/@scope/name.json` (the project's own
  packages), `apps/<app>.json`. It is never published and never written next to the sources.
  `nf_modules` stays untouched.
- **Generated at init when missing, regenerated when stale:** when `sourceHash`, `metaVersion`,
  `generator.version` or the installed owners (added, removed, other `version` or `schema`) differ.
- **Owner plugin missing:** its tags are kept raw in the item's `unclaimedTags`, with a warning. A
  regeneration without the plugin doesn't produce its owner object, so the object disappears. It
  comes back when the plugin is installed (the owners changed, so the meta is regenerated).
- **`nf publish`** has nothing to do with the meta.

### Catalog

Core owns a generic, reactive **catalog**: items by `ItemRef` (`@nanoforge/motion#Position`, or
`app:client#Paddle` for an app), from providers (`nf_modules`, project packages, project apps).
Plugins build views on it: the ECS plugin's component and system registries are the items whose
`@nanoforge/ecs.type` is `component` or `system`.

## Open questions

1. ~~**Imports into `nf_modules`.**~~ Decided in ADR 0004: by package name, through the root `tsconfig.json` `paths`.
   **Was:** The example uses relative paths across packages
   (`../../motion/components/position`). Should there be an alias (`@nf/<scope>/<name>/…`), set up
   by `nf install` in tsconfig and the build?
2. ~~**Name collisions.**~~ Decided in ADR 0005: plain names stay, the app's item wins and the editor warns.
   **Was:** The ECS registry keys on `name`: `@nanoforge/motion#Position` and the
   app's own `Position` would clash. Namespaced names, or a rule that forbids it?
3. ~~**Root index.**~~ Decided in ADR 0005: `nanoforge.packages.json` and its lock list the packages; the catalog still reads `nf_modules/@<scope>/<name>/`.
   **Was:** Should `nf install` write a list of the installed packages (like a lockfile), so
   the catalog has one entry point, or does the catalog read `nf_modules/@<scope>/<name>/`?
4. ~~**Sub-manifests.**~~ Decided in ADR 0005: every package is published and installable alone; a bigger one lists the others in `dependencies`.
   **Was:** Can `@nanoforge/shapes` be installed alone, or only as part of `render-2d`?
5. **Engine libs' own items.** Do graphics-2d or network ship items the same way?
6. ~~**Editor hints.**~~ Partly decided: layout tags are core (groups, presets, labels, colors,
   hidden). Still open: value hints such as `@min`, `@max`, `@step`.
   **Was:** Tags for the inspector (`@min`, `@max`, `@step`, `@color`): core, or owner
   tags?
7. **Headless generation** (later): the `@nanoforge-dev/editor-meta` package run by a command.
