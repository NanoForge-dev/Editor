# ADR 0006 — Source layout and naming

- Status: accepted (2026-10-04), piloted on `packages/settings` and `plugins/git`
- Related: the engine (`../engine`, `origin/main`) and the CLI (`../cli`, `origin/main`), whose
  layout this follows

## Context

The editor grew one phase at a time, and each workspace got its own habits:

- tests next to the code (`packages/kernel/src/**/*.test.ts`), or in `test/` with flat names;
- flat `src/` folders of 15 files (`packages/settings`, `plugins/git`), or feature folders
  (`packages/server-core`);
- Svelte components at the root of a plugin's `src/`, or in `widgets/`;
- files of 500 to 800 lines holding several classes or views.

The engine and the CLI already share one layout: feature folders with an `index.ts`, kebab-case
files named after what they export, a suffix for each kind of file, and tests in `test/` named
`.spec.ts`. The editor follows them.

## Decision

### Workspace

```
<workspace>/
  src/
    index.ts                   the entry: a barrel (packages), or definePlugin (plugins)
    <feature>/
      index.ts                 re-exports the feature's public files
      <name>.ts
      <kinds>/<name>.<kind>.ts a family of files of one kind
  test/
    <feature>/<name>.spec.ts   mirrors src/
    fixtures/
```

- **Feature folders.** `src/` holds `index.ts` and folders. Each folder is one feature, named in
  kebab-case and in the singular (`store`, `account-sync`, `definition`), like the engine's
  `application`, `library-registry`, `exception`.
- **Barrels.** A folder's `index.ts` re-exports what leaves the folder. A package's `src/index.ts` only
  re-exports its folders (`export * from './store'`), with no code of its own. Files inside a
  workspace import each other by path, never through their own package's barrel.
- **Subpath entries** (`editor-code/engine`, `editor-meta/pure`, `editor-sdk/ui`, registry `/types`)
  are files at the root of `src/` next to `index.ts`, named after the subpath.
- **Families.** Implementations of one interface are named `<variant>.<kind>.ts` for a class
  `<Variant><Kind>`, like the CLI's `build.action.ts` and the engine's `tcp.client.network.ts`:
  `MemoryScopeStore` → `memory.scope-store.ts`, `IndexedDbKeyValueStore` →
  `indexed-db.key-value-store.ts`. They stay in their feature folder; a plural sub-folder
  (`actions/`) only when the family is large and the folder holds other files.

### Files

- **kebab-case**, named after the main export: `SettingsService` → `settings-service.ts`,
  `createActions` → `create-actions.ts`. One main export per file; small helpers that only it uses
  stay with it.
- **Kind suffixes**, after the engine and the CLI:

  | Suffix          | Holds                                                           |
  | --------------- | --------------------------------------------------------------- |
  | `.type.ts`      | types and interfaces only, no values                            |
  | `.enum.ts`      | an enum, or an `as const` list and its union type               |
  | `.exception.ts` | an `Error` subclass (several go in `exceptions/`)               |
  | `.abstract.ts`  | an abstract class                                               |
  | `.factory.ts`   | a function that picks and builds one of several implementations |
  | `.const.ts`     | constants shared by several files of the feature                |
  | `.<kind>.ts`    | a member of a family: `.scope-store.ts`, `.contract.ts`…        |

- **Tokens** (`createToken`) live in the file of the class or interface they inject.
- **Svelte components** are kebab-case when an `index.ts` re-exports them (the kit:
  `button.svelte`), PascalCase otherwise (a plugin's `CommitView.svelte`). Rune modules are
  `<name>.svelte.ts`.
- **Size.** A file that passes about 300 lines (a Svelte file's `<style>` not counted) is split
  along its responsibilities: a view into child components and pure helpers, a service into the
  parts it coordinates. A class that is one state machine (`PluginHost`, `RuntimeService`) may stay
  longer: its types, exceptions and helpers still leave it.
- **State stays where it lived.** When a component is split, the state its script held stays owned
  above every `{#if}`, `{#key}` or gate the new children sit under, or it is lost each time they
  unmount (a commit message lost on a tab switch). Pass it down as props, `$bindable` props or a
  rune class in a `<name>.svelte.ts` file (`commit-panel-state.svelte.ts`).

### Plugins

```
plugins/<name>/src/
  index.ts         definePlugin: activation and registrations only
  widgets/         the views the manifest's widgets mount (<Name>View.svelte), and their parts
  dialogs/         a dialog component and the function that mounts it (open-<name>-dialog.ts)
  session/         what activate() shares with the widgets (<name>-session.ts)
  <feature>/       the plugin's logic: service, store, model, actions…
  worker/          code that runs in the code worker; index.ts is the manifest's worker entry
  icons.ts         the icons the plugin registers
```

- Plugin folders have no `index.ts`: nothing imports a plugin, so its files import each other by
  path, and its Svelte components stay PascalCase.
- A view's parts sit next to it (`widgets/commit/CommitView.svelte`, `ChangesTab.svelte`…); parts
  shared by several views sit in `widgets/` (`ConfirmDialog.svelte`).
- A tab or panel whose state must outlive its `{#if}` keeps it in a rune class next to it
  (`commit-panel-state.svelte.ts`, `packages-dialog-state.svelte.ts`), owned by the view.
- The manifest's entry files (`index.js`, `worker.js`), the CSS name (`cssFileName`) and the widget
  ids do not change with the layout.

### Tests

- In `test/`, mirroring `src/` (`src/store/json-file.scope-store.ts` →
  `test/store/json-file.scope-store.spec.ts`), named `<name>.spec.ts`; one `describe` per unit.
  Tests import the package's entry (`../../src`) or the file under test. Vitest browser tests are
  `<name>.svelte.spec.ts`. Helpers shared by several specs go in `test/fixtures/`.
- Fixtures go in `test/fixtures/`. Snapshots and screenshots follow their spec's name: rename them
  with it, never regenerate them to make a move pass.
- E2E specs stay in `apps/editor/e2e/` (already `<name>.spec.ts`).

## Not adopted from the engine

- **Per-workspace `eslint.config.js` and `prettier.config.js`.** The root ESLint config scopes its
  import boundaries by path (`packages/kernel/**`, `plugins/**`); a package config that re-exports it
  would match them against the package's own folder and lose them.
- **`tsconfig.spec.json`.** The editor typechecks tests with the sources (`tsc` or `svelte-check` on
  one `tsconfig.json`) instead of through Vitest's typecheck.

## Consequences

- Every move keeps the public API: the SDK snapshot test runs without `-u` after each workspace.
- Documentation that cites paths (CLAUDE.md, `docs/`) follows each move.
- `examples/counter-plugin` mirrors what `nf create plugin` writes (`../cli-editor`). It changes with
  the CLI's template, not on its own.
