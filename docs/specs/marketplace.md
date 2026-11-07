# Marketplace: plugins and packages

Requirements session: 2026-10-01. The fifth and last item of phase 11. Two separate interfaces, as asked: **plugins** are installed from Settings › Plugins (as in IntelliJ), **packages** from a Packages dialog. Both read the same registry.

## Decisions taken in this session

They settle the install questions ADR 0003 left open (see ADR 0005).

- **The registry is not built yet.** This phase defines its contract and runs on a stand-in: a registry read from a local folder. The contract goes to the API team in phase 12.
- **The editor server installs**, without the CLI. The code that talks to the registry, installs and keeps the project's list lives in one package with no editor dependency, `@nanoforge-dev/registry` (`packages/registry`), so it can move to the CLI repository and be used by both.
- **A project lists its packages**: `nanoforge.packages.json` (names and version ranges, written by hand or by the editor) and `nanoforge.packages.lock.json` (the exact versions installed, with their hashes). `nf_modules` can then be left out of git and restored from the lock.
- **Sub-packages are published too.** Every package is a registry entry and can be installed alone. A bigger package names the ones it needs in `dependencies`, and they are installed next to it in `nf_modules` (not inside it).
- **Name collisions**: plain names stay. The app's own item wins over a package's, and the editor warns (the ECS plugin's collision warning). Refusing an install because two packages define the same item is **not built**: the registry would have to know item names.

## Registry contract

The contract is [`docs/api/registry.md`](../api/registry.md): routes after the npm registry's (one document per item with its versions, archives under `/-/`, search under `/-/v1/search`), read without a key. Every entry has a `type` (`plugin` or `package`) and a name `@scope/name`.

The stand-in (`DirectoryRegistry`) reads the same data from a folder (`<dir>/@scope/name/<version>/…` holding each version's files, plus an optional `README.md` in a version and `registry.json` with `{ author, downloads }` beside the versions) and is served over the same routes for tests. Version folders added or removed are seen without a restart.

The editor server uses the folder when `REGISTRY_DIR` is set, a registry elsewhere with `REGISTRY_URL`, and the API's once `registry` is listed in `API_FEATURES`. Otherwise, and whenever the registry cannot be reached, both interfaces say it is not available and offer to try again; what is installed keeps working and stays listed.

## Plugins (Settings › Plugins)

The page gets two tabs.

- **Marketplace**: search the registry's plugins. Each result shows its name, description, author and latest version; selecting one shows its readme and versions. **Install** asks where: _For me_ (`~/.nanoforge/editor/plugins`, every project) or _For this project_ (`.nanoforge/plugins`). An installed plugin shows **Installed**, or **Update** when the registry has a newer version that fits this editor.
- **Installed**: the list there is today (name, version, source, status, enable switch), plus **Uninstall** and **Update** for plugins installed from the marketplace. Built-in and dev plugins can't be uninstalled.
- **Account list:** a plugin installed _for me_ is added to the account's settings (`plugins.account`), and removed when uninstalled. A local editor that lacks a plugin of that list offers to install it, or to remove it from the account. Local editors have no sign-in and keep the account document on their machine, and hosted editors install no plugins: the list only travels between machines once local editors sign in and sync account settings with the API, which is not built.
- A plugin installed, updated or removed takes effect after a reload: the page offers _Reload now_, as it does for the enable switch.
- A version whose `engines.editor` does not fit this editor is not offered.
- A plugin with a server entry: the entry starts when the plugin is installed and stops when it is uninstalled, without restarting the editor server. As for every project plugin, a project plugin's server entry only runs in a local editor.

## Packages (Packages dialog)

_File › Packages…_, also in the command palette. Two tabs. The dialog belongs to a built-in plugin of its own, `@nanoforge/packages` (`plugins/packages`), loaded when the command first runs.

- **Browse**: search the registry's packages; a result shows its name, description, latest version and what it depends on. **Install** adds it to the project with the range `^<version>`, installs it and its dependencies into `nf_modules`, and adds the import paths (root `tsconfig.json` `paths`, ADR 0004).
- **Installed**: the project's packages with their installed and latest versions. **Update** (to the newest version in its range, or to the latest), **Uninstall** (refused while another installed package depends on it; dependencies nobody needs any more are removed too).
- **Restore**: when the lock lists packages that are not in `nf_modules` (a fresh clone), the dialog says so and installs them.
- `nf_modules` stays read-only in the editor: installing is the only way to change it.
- **Git:** the editor never edits the project's `.gitignore`. Whether `nf_modules` is committed or ignored (and restored from the lock) is the project's choice.
- After a change, the catalog is read again, so the items of a new package show in the ECS browser at once.

## The `@nanoforge-dev/registry` package

No editor dependency (zod, semver and a zip reader only).

- `RegistryClient` (HTTP) and `DirectoryRegistry` (a folder), behind one `Registry` interface: `search`, `get`, `download`.
- `serveRegistry(registry)`: the contract's routes as a `fetch` handler (tests, and the contract tests of phase 12).
- `installItem`: downloads a version, checks its hash and its manifest (name, version, type), and unpacks it safely (no path outside of the target) into a folder, replacing what was there. Nothing is touched before the archive passed every check, and the manifest is written last, so a folder without one is an install that did not finish.
- `ProjectPackages`: the project's list and lock, `install`, `uninstall`, `update`, `restore`, `outdated`; dependency resolution (the newest version that fits every range asked for, an error naming both sides when none does; installed versions are kept until asked to update); the `tsconfig.json` paths, added and removed with the file's comments kept. Changes of one project run one after the other.
- Safety: names are checked before any path is built; an archive with a path outside of its folder, a wrong hash, or a manifest that is not the item asked for is refused before anything is written.
- ESLint keeps `@nanoforge-dev/editor-*` imports out of it.

## Core additions

- **Server**: a `RegistryContract` (search, details, plugin install/uninstall, package list/install/uninstall/update/restore). Installing is refused in hosted editors.
- **Settings UI**: the Plugins page's tabs.
- **SDK**: the contract and its types.
- **E2E**: `prepare-workspace.mjs` writes a small registry (`.registry` in the e2e workspace: the `@acme/badge` plugin, the `@acme/shapes` and `@acme/render` packages) and the test server gets it as `REGISTRY_DIR`.

## Not built

- The real registry, publishing, accounts' plugin lists (phase 12).
- Refusing an install on item-name collisions between two packages.
- Engine libraries (they stay on npm).
- Aligning the CLI's `nf install` with this format: the package is written so the CLI can use it.
- A test of the refusal for a signed-in user of a hosted editor (no test signs in; visitors are refused earlier).

## Done when

- Unit tests of the registry package: search and details through HTTP and from a folder, hash check, unsafe archive paths, install and replace, dependency resolution and conflicts, list and lock, uninstall with dependents and orphans, restore, tsconfig paths with comments kept.
- Server tests: the contract through RPC, on a folder registry.
- Browser tests (on a folder registry):
  - find a plugin in the marketplace, install it for me, reload, see it active, uninstall it;
  - find a package, install it with its dependency, see both in `nf_modules` and in the Installed tab, see its items in the ECS browser, uninstall;
  - an update shows and applies.
