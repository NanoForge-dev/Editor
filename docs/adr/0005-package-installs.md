# ADR 0005: installing packages and plugins

Date: 2026-10-01. Status: accepted. It settles the install questions ADR 0003 left open.

## Decisions

1. **Who installs.** The editor server, with a package that has no editor dependency (`@nanoforge-dev/registry`). It is meant to move to the CLI repository, where `nf install` will use it too.
2. **The project's list.** `nanoforge.packages.json` holds the packages a project asks for, with version ranges. `nanoforge.packages.lock.json` holds what is installed: exact versions, archive hashes, and each package's own dependencies. `nf_modules` can be restored from the lock, so it may be left out of git. The editor does not edit the project's `.gitignore`: that choice is the project's.
3. **Sub-packages.** Each package is published on its own and can be installed alone. A package that needs others lists them in `dependencies` (`{ "@scope/name": "^1.0.0" }`); they are installed side by side in `nf_modules/@scope/name`, one version each. `include` stays for folders inside one published package.
4. **Version conflicts.** One version of a package per project. When two ranges have no version in common, the install is refused and names both.
5. **Name collisions of items.** Plain names stay. The app's own item wins over a package's and the editor warns. Refusing installs on collisions between two packages is left for when the registry knows item names.
6. **The registry.** Its HTTP contract is in `docs/api/registry.md`, with routes after the npm registry's. Until the backend exists, the editor runs on a registry read from a folder.

## Still open

- Engine libraries: npm, or the registry.
- Inspector value hints (`@min`, `@max`, `@step`).
- Headless meta generation.
