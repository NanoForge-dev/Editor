# ADR 0004 — Shared libraries: components and systems shared by several apps

- Status: accepted (2026-09-27)
- Related: ADR 0003 (items, packages, plugins), `docs/specs/ecs.md`

## Context

A NanoForge project has several apps (usually `client` and `server`), each with its own
`src/components` and `src/systems`. A game needs components that both sides use (`Position`,
`Velocity`, a `Player` with its id). Today they are copied into each app, and the copies drift.

The CLI already knows a workspace member of `type: "lib"` in `nanoforge.config.ts`: a folder with
`dir.components`, `dir.systems`, `dir.assets`, `dir.scenes` and no entry file. The editor's project
discovery already lists libs, and the build already skips them (their code is bundled into the apps
that import it).

The user wants, in the editor, to create components and systems shared between client and server.
Publishing is out of scope: a lib stays in its project.

## Decision

### A shared library is a lib workspace member

```
nanoforge.config.ts          { type: "workspace", packages: ["apps/*", "libs/*"] }
libs/shared/
  nanoforge.config.ts        { type: "lib", dir: { components: "src/components", … } }  ← the CLI defaults are shared/…
  package.json               { "name": "@pong-network/shared", "private": true }
  src/components/player.ts   /** @component  @side shared */
  src/systems/score.ts       /** @system     @side server */
```

- No `nanoforge.manifest.json`: a lib isn't published, so it needs no registry identity. Its name
  is its `package.json` name.
- Items are found like in an app: the exports of `dir.components` / `dir.systems` that an owner tag
  claims (`@component`, `@system`).
- **Side is per item**, not per lib: one lib holds client, server and shared items. An app is offered
  the items whose `@side` matches it and whose required engine libraries it has.
- A lib may import engine libraries (`@nanoforge-dev/*`), installed packages (`nf_modules`) and other
  libs. It never imports an app. The editor reports an import of an app, and a cycle between libs.

### Imports use the package name

Apps import items from a lib, and from an installed package, by package name:

```ts
import { Position } from '@nanoforge/motion/components/position';
import { Player } from '@pong-network/shared/components/player';
```

- The project's root `tsconfig.json` maps them with `paths`:
  `"@pong-network/shared/*": ["libs/shared/src/*"]` and
  `"@nanoforge/motion/*": ["nf_modules/@nanoforge/motion/*"]`. The editor writes the lib entry when it
  creates a lib; package entries come with installing (not built yet).
- The code worker resolves through the same `paths`, so the editor's diagnostics, completion and the
  codegen's import edits all agree.
- Moving an item between a lib and a package never changes the importing code's shape.
- This answers ADR 0003's open question 1 (imports into `nf_modules`).
- To check while building: that `nf build` honors `paths`. If it doesn't, fall back to a
  `workspace:*` dependency plus an install run by the editor.

### Items and catalog

- Item references: `<package name>#<export>`, e.g. `@pong-network/shared#Player`. Apps keep
  `app:<app>#<export>`.
- The meta of a lib is cached like a project package's:
  `.nanoforge/editor/cache/meta/libs/<package name>.json`.
- The catalog has a `lib` provider next to `app` and `module` (`nf_modules`). Lib items are editable;
  package items are read-only.
- ECS name collisions: the ECS plugin warns when two items that the same app can use share a
  registry `name` (an app's `Position` and a lib's `Position`).

### Words in the UI

"Lib" is already used in the editor for engine libraries (`engineLibs`), so the UI always says which
kind it means. Code and config keep `lib`, as the CLI does.

| Thing                                        | UI name               | Example                               |
| -------------------------------------------- | --------------------- | ------------------------------------- |
| An app (`apps/client`)                       | **App**               | App _client_                          |
| A lib workspace member (`libs/shared`)       | **Shared library**    | Shared library _shared_               |
| An installed package (`nf_modules`)          | **Installed package** | Installed package _@nanoforge/motion_ |
| An npm engine library (`@nanoforge-dev/ecs`) | **Engine library**    | Engine library _ecs_                  |

The component and system browser groups items under those headings: the selected app first, then
each shared library, then installed packages (with a lock).

### Editor features (phase 10, ECS plugin and core)

- **New shared library** (command, and a button in the browser): asks for a folder name (default
  `shared`) and the package name (default `@<project>/<folder>`). It creates `libs/<folder>/`
  (`nanoforge.config.ts`, `package.json`, `src/components`, `src/systems`), adds `libs/*` to the
  workspace `packages` when missing, and adds the `paths` entry. One undoable step.
- **New component / New system** ask where: the selected app (default) or a shared library. In a
  shared library, `@side` defaults to `shared`.
- **Move to shared library**: moves a component or system from an app into a lib, rewrites every
  import in the project, one undoable step.
- **Copy to…** on an installed package's item copies it into an app or a shared library.
- Adding a lib item to an entity or an app adds the package-name import.
- While playing, a change in a lib rebuilds every app that imports it (the build orchestrator
  follows imports).

### Which apps use a library, and managing them (2026-10-03)

- **An app uses a library when its `nanoforge.config` lists it in `libs`**: paths relative to
  the app, the field the CLI's config defines for this (`libs: ["../../libs/shared"]`).
  `AppModel.libraries` holds the project's libraries an app uses.
  - The editor keeps the app's `package.json` in step (`"@pong-network/shared": "workspace:*"`,
    for package managers): every change writes both. Where they disagree (an edit by hand), `libs`
    wins and the project shows a warning that says what to add.
  - A library's config has no `libs`: a library uses another through its `package.json`.
  - Until 2026-10-03 the editor read `libs` as engine library names, which the CLI never meant.
    The editor reads engine libraries from `package.json` only.
- An app is only offered the items of the libraries it uses (`itemFitsApp`). An app that imports a
  library it does not use is reported, with the fix named.
- **A library that no app lists is given to every app**, so a project made before this rule keeps
  working. The Project screen says so; the first tick or untick writes `libs` and the dependencies down.
- `nf build` (Bun) honors the root `paths`, checked on `examples/pong-game`: the dependency is a
  declaration, and nothing needs installing for a library to build and play.
- The **Project screen** manages the workspace: add, rename and remove client apps, server apps and
  shared libraries, and tick the apps that use each library. Every change is one step of the
  _Project_ history. The operations are `packages/project/src/workspace/` (in the SDK), which
  the ECS plugin's _New shared library…_ uses too.
  - Renaming a library rewrites its `paths` entry, the dependencies on it and every import of it.
  - Removing a library is refused while a file imports it; the files are named.
  - A new app is empty (engine libraries at the versions of another app) or a copy of an app of
    its type. An empty app needs its dependencies installed: the editor offers to run the
    project's package manager, found from its lockfile (`projects.install`, local editors only).
  - The last app of a project can't be removed.
- **Several clients or servers**: Play starts one client and one server. With two or more of a
  type, the Run menu gets a _Client app_ or _Server app_ submenu (`runtime.clientApp`,
  `runtime.serverApp`, kept with the project for this machine). With one of each, the menu is
  unchanged.
- Not built: two servers of one project running at once, several clients side by side in the
  editor (a second client opens in its own window), publishing a library as a package.

## Consequences

- Client and server share one definition of each shared component, which network code needs.
- No publishing: turning a lib into a package later means adding a `nanoforge.manifest.json`.
- The root `tsconfig.json` becomes something the editor edits (only its `paths` entries).
