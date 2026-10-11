# Registry of plugins and packages — NanoForge API contract

Status: **implemented** by the API (registry v2). The full contract, publishing and scopes included, is the API's `docs/registry.md`; this page is what the editor and the CLI rely on. The editor ships a client (`RegistryClient`), a reference implementation of the read routes (`serveRegistry`, over a folder) and contract tests, all in `packages/registry` (`@nanoforge-dev/registry`), a package meant to move to the CLI repository so `nf install` and `nf publish` use the same code.

The routes follow the **npm registry**: one document per item with all its versions (the "packument"), archives under `/-/`, dist-tags, search under `/-/v1/search`. What differs from npm: every item has a `type`, archives are **zip** files stored as published, every version says **what it holds** (`contents`, counted in `kinds`), and `dist` adds a hex **sha256** to npm's hashes.

## Model

- An **item** has a name `@scope/name` (lowercase letters, digits and `-`) and a `type`, fixed by its first publication:
  - `package`: components, systems, scenes, assets… installed in a project's `nf_modules/@scope/name`;
  - `plugin`: an editor plugin (its built `dist`), installed in `~/.nanoforge/editor/plugins` or in a project's `.nanoforge/plugins`.
- An item has **versions** (semver). A version is an archive: a zip with `nanoforge.manifest.json` at its root. A published version never changes, and an unpublished version number is never reused.
- The scope belongs to a user: their username, or a previous one that held packages.

## The manifest

```jsonc
{
  "name": "@acme/kit",
  "version": "1.2.0",
  "type": "package",
  "description": "Components and assets for 2D platformers",
  "keywords": ["2d"],
  "dependencies": { "@acme/physics": "^1.0.0" }, // or ["@acme/physics"]
  "libDependencies": { "@nanoforge-dev/ecs": "^1.0.0" },
  "engines": { "editor": ">=0.1.0" },
  "suggestedPlugins": ["@nanoforge/ecs"], // or { "@nanoforge/ecs": "^1.0.0" }
  "contents": [
    { "kind": "asset", "path": "assets/sprites/" },
    { "kind": "type", "path": "src/types.ts", "export": "Direction" },
  ],
  "include": ["src/player", "assets/sounds.json"],
}
```

- `contents`: what the package holds, whatever its folder layout. `kind` is a core kind (`asset`, `type`, `enum`, `file`…) or one owned by a plugin (`@nanoforge/ecs:component`); `path` is a file, or a folder ending with `/`; `export`, `name`, `description`, `side`, `tags` are optional; any other key is an owner object (`"@scope/name": { … }`).
- `include`: **sub-manifests**, folders (their `nanoforge.manifest.json`) or `.json` files, relative to the manifest listing them. A sub-manifest only holds `contents`, `include`, `$schema` and owner objects, its paths relative to its own folder. 4 levels and 100 sub-manifests at most.
- The editor reads both with `readPackageContents` (`@nanoforge-dev/registry/types`): the catalog takes the code files `contents` points to as item sources. `items` (source files, before `contents`) is still read.

## Reading

**No API key and no user**: local editors and the CLI have neither.

### `GET /registry/@scope/name`

The item with every version. The name may come encoded as npm clients send it (`@scope%2Fname`).

```jsonc
{
  "_id": "@acme/render",
  "name": "@acme/render",
  "type": "package",
  "description": "Draws shapes.",
  "author": { "name": "Acme" }, // only when the manifest names one
  "maintainers": [{ "name": "acme" }],
  "readme": "# Render\n…",
  "dist-tags": { "latest": "1.1.0" },
  "versions": {
    "1.1.0": {
      // the manifest, normalized, then:
      "name": "@acme/render",
      "version": "1.1.0",
      "type": "package",
      "dependencies": { "@acme/shapes": "^1.0.0" },
      "engines": { "editor": ">=0.1.0" },
      "suggestedPlugins": { "@nanoforge/ecs": "*" },
      "contents": [
        {
          "kind": "@nanoforge/ecs:component",
          "path": "src/circle.ts",
          "manifest": "src/nanoforge.manifest.json",
          "fileCount": 1,
          "size": 412,
        },
      ],
      "manifests": ["src/nanoforge.manifest.json"],
      "kinds": { "@nanoforge/ecs:component": 1 },
      "dist": {
        "tarball": "https://api.nanoforge.eu/registry/@acme/render/-/render-1.1.0.zip",
        "integrity": "sha512-…",
        "shasum": "<sha1>",
        "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        "size": 18230,
        "unpackedSize": 54000,
        "fileCount": 42,
      },
    },
  },
  "time": { "created": "…", "modified": "…", "1.1.0": "2026-10-02T09:00:00.000Z" },
  "downloads": { "total": 1250 },
}
```

- `dist-tags.latest`: the highest stable version, unless a publisher moved it.
- `versions[v].contents`: every content, the sub-manifests' included, with paths from the archive root and the sub-manifest it comes from (`manifest`). `kinds` counts them.
- `versions[v].dist.tarball`: where the archive is, absolute (the client also takes it relative to the registry's base URL). `dist.sha256` is what the editor checks and keeps in the lock.
- With `Accept: application/vnd.npm.install-v1+json`, versions keep what installing needs (dependencies, engines, suggested plugins, `kinds`, `dist`), without `contents` nor the readme. The client asks for it before a download.
- Required by the editor: `name`, `type`, `dist-tags.latest`, `versions` with `name`, `version`, `type`, `dist.tarball`, `dist.sha256`. It ignores fields it does not know.

| Status | Meaning                              |
| ------ | ------------------------------------ |
| `200`  | the document above                   |
| `304`  | unchanged since `If-None-Match`      |
| `404`  | no such item (`{ "error": string }`) |

### `GET /registry/@scope/name/-/name-<version>.zip`

The archive, `application/zip`, exactly as published. `404` when the version does not exist. Counts as a download.

### `GET /registry/-/v1/search?text=&type=&kind=&from=&size=`

- `text`: words searched in names, keywords, descriptions and content names (all must match), with the qualifiers `kind:`, `type:`, `scope:` and `keywords:`; empty lists everything.
- `type`: `plugin` or `package`; `kind`: only items whose latest version holds it.
- `from` (default 0) and `size` (default 20, at most 250) page through the results.

```jsonc
{
  "objects": [
    {
      "package": {
        "name": "@acme/render",
        "scope": "acme",
        "type": "package",
        "version": "1.1.0",
        "description": "Draws shapes.",
        "keywords": [],
        "date": "2026-10-02T09:00:00.000Z",
        "publisher": { "username": "acme" },
        "kinds": { "@nanoforge/ecs:component": 1 },
        "suggestedPlugins": { "@nanoforge/ecs": "*" },
      },
      "downloads": { "total": 1250 },
      "score": { "final": 3.2 },
      "searchScore": 3.2,
    },
  ],
  "total": 1,
  "time": "…",
}
```

The editor shows `author.name` when there is one, else `publisher.username`.

## Publishing

Not done by the editor: `nf publish` will. Authentication is a **registry key** (the `/registry-key` endpoints) in `Authorization: Bearer <key>`; its authorizations (`@scope/*` or `@scope/name`) say what it may publish.

`PUT /registry/@scope/name`, `multipart/form-data`: `archive` (the zip, at most 20 MiB) and an optional `tag`. The registry reads name, version and type from the archive's manifest, checks every `contents` path and sub-manifest, computes the hashes, and stores the archive as is.

| Status | Meaning                                       |
| ------ | --------------------------------------------- |
| `201`  | published                                     |
| `400`  | a check on the archive or the manifest failed |
| `401`  | no key, or an expired one                     |
| `403`  | the key may not publish this name             |
| `409`  | the version exists or existed                 |
| `413`  | the archive is too large                      |

`DELETE /registry/@scope/name/-/name-<version>.zip` unpublishes a version: projects that locked it can no longer restore it.

### Plugins

A plugin's archive is its built `dist` folder: the manifest, the bundles it names in `entry`, its assets. Its manifest carries what the editor checks before loading it, so the registry only stores and returns it:

- `engines.editor`: the editor versions it runs on. The marketplace offers the newest version that fits the running editor.
- `build`: the versions of the shared modules it was compiled against (the Svelte runtime, the SDK). The editor refuses a plugin built for an incompatible runtime.

## Checking an implementation

`pnpm --filter @nanoforge-dev/registry test:contract` (see [README](README.md#contract-tests)) reads one published item through every read route: the document (`dist.tarball`, `kinds`), the archive and its hash, search with text, type and paging, and the `404`s.
