# Registry of plugins and packages — NanoForge API contract

Status: **proposed**, to be implemented by `api.nanoforge.eu`. The editor ships a client (`RegistryClient`), a reference implementation of the read routes (`serveRegistry`, over a folder) and contract tests, all in `packages/registry` (`@nanoforge-dev/registry`), a package meant to move to the CLI repository so `nf install` and `nf publish` use the same code.

The routes follow the **npm registry**: one document per item with all its versions, archives under `/-/`, search under `/-/v1/search`. Three things differ from npm: every item has a `type`, archives are **zip** files, and their hash is a hex **sha256**.

## Model

- An **item** has a name `@scope/name` (lowercase letters, digits and `-`) and a `type`:
  - `package`: components, systems, assets… installed in a project's `nf_modules/@scope/name`;
  - `plugin`: an editor plugin (its built `dist`), installed in `~/.nanoforge/editor/plugins` or in a project's `.nanoforge/plugins`.
- An item has **versions** (semver). A version is an archive: a zip with `nanoforge.manifest.json` at its root. A published version never changes.
- The scope is the publisher: a user name or an organisation.

## Reading

**No API key and no user**: local editors and the CLI have neither.

### `GET /registry/@scope/name`

The item with every version. The name may come encoded as npm clients send it (`@scope%2Fname`).

```json
{
  "name": "@acme/render",
  "type": "package",
  "description": "Draws shapes.",
  "author": { "name": "Acme" },
  "readme": "# Render\n…",
  "dist-tags": { "latest": "1.1.0" },
  "versions": {
    "1.1.0": {
      "name": "@acme/render",
      "version": "1.1.0",
      "type": "package",
      "dependencies": { "@acme/shapes": "^1.0.0" },
      "engines": { "editor": ">=0.1.0" },
      "dist": {
        "file": "/registry/@acme/render/-/render-1.1.0.zip",
        "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        "size": 18230
      }
    }
  },
  "time": { "1.1.0": "2026-10-02T09:00:00.000Z" },
  "downloads": { "total": 1250 }
}
```

- `dist-tags.latest`: the highest version that is not a pre-release.
- `versions[v].dependencies`: other registry items, with semver ranges. `engines.editor`: the editor versions a plugin runs on. Both are copied from the manifest in the archive at publish time, so they can be read without downloading it.
- `versions[v].dist.file`: where the archive is, absolute or relative to the registry's base URL (it may be a file server). `dist.sha256`: computed by the registry at publish time.
- Required: `name`, `type`, `dist-tags.latest`, `versions` with `name`, `version`, `type`, `dist.file`, `dist.sha256`. The editor ignores fields it does not know.

| Status | Meaning                              |
| ------ | ------------------------------------ |
| `200`  | the document above                   |
| `404`  | no such item (`{ "error": string }`) |

### `GET /registry/@scope/name/-/name-<version>.zip`

The archive, `application/zip`. `404` when the version does not exist. Counts as a download.

### `GET /registry/-/v1/search?text=&type=&from=&size=`

- `text`: words searched in names and descriptions (all must match); empty lists everything.
- `type`: `plugin` or `package`; absent means both.
- `from` (default 0) and `size` (default 30, at most 100) page through the results.
- Order: best match first; the editor's stand-in orders by downloads, then name.

```json
{
  "objects": [
    {
      "package": {
        "name": "@acme/render",
        "type": "package",
        "version": "1.1.0",
        "description": "Draws shapes.",
        "date": "2026-10-02T09:00:00.000Z",
        "author": { "name": "Acme" }
      },
      "downloads": { "total": 1250 }
    }
  ],
  "total": 1
}
```

`package.version` is the latest version, `date` its publication date, `total` the count of all matches.

## Publishing

Not used by the editor yet: `nf publish` will. Authentication is a **registry key** (the existing `/registry-key` endpoints), sent as `Authorization: Bearer <key>`. A key's authorizations (`scope/*` or `scope/name`) say what it may publish.

### `PUT /registry/@scope/name`

Publishes one version, as npm does: the document with the new version and its archive attached.

```json
{
  "name": "@acme/render",
  "versions": { "1.1.0": { "name": "@acme/render", "version": "1.1.0", "type": "package" } },
  "readme": "# Render\n…",
  "_attachments": {
    "render-1.1.0.zip": { "content_type": "application/zip", "data": "<base64>", "length": 18230 }
  }
}
```

The registry checks, before storing anything:

- the key may publish `@scope/name`;
- the archive is a zip, at most **20 MiB**, whose entries all stay inside it (no absolute path, no `..`);
- `nanoforge.manifest.json` is at its root and says the same `name`, `version` and `type` as the request;
- the `type` is the item's type (an item never changes type);
- the version does not exist yet.

It then computes the sha256, copies `dependencies`, `engines` and `description` from the manifest, and moves `latest`.

| Status | Meaning                                       |
| ------ | --------------------------------------------- |
| `201`  | published                                     |
| `400`  | a check on the archive or the manifest failed |
| `401`  | no key, or an expired one                     |
| `403`  | the key may not publish this name             |
| `409`  | the version exists                            |
| `413`  | the archive is too large                      |

### `DELETE /registry/@scope/name/-/name-<version>.zip`

Unpublishes a version (same key rules; `latest` moves to the highest remaining version, the item goes with its last version). Projects that locked that version can no longer restore it: keep it for mistakes and takedowns.

### Plugins

A plugin's archive is its built `dist` folder: the manifest, the bundles it names in `entry`, its assets. Its manifest carries what the editor checks before loading it, so the registry only stores and returns it:

- `engines.editor`: the editor versions it runs on. The marketplace offers the newest version that fits the running editor.
- `build`: the versions of the shared modules it was compiled against (the Svelte runtime, the SDK). The editor refuses a plugin built for an incompatible runtime.

## What changes from today's registry

| Today (`/registry/{username}/{package}`, `/packages`) | This contract                                |
| ----------------------------------------------------- | -------------------------------------------- |
| types `component`, `system`                           | types `package`, `plugin`                    |
| name `username/package`                               | `@scope/name`                                |
| one source file per package, replaced on publish      | versions, each a zip archive, never replaced |
| `dependencies`: a list of names                       | `{ "@scope/name": "<range>" }`               |
| search at `GET /packages`, signed-in users only       | `GET /registry/-/v1/search`, public          |
| publish: `PUT` with a manifest and one file           | `PUT` with the npm publish document          |
| registry keys                                         | unchanged                                    |

The current routes can stay for the published CLI until it moves to the shared package.

## Checking an implementation

`pnpm --filter @nanoforge-dev/registry test:contract` (see [README](README.md#contract-tests)) reads one published item through every read route: the document, the archive and its hash, search with text, type and paging, and the `404`s.
