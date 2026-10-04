# NanoForge API: what the editor needs

Hand-off to the API team (rewrite plan, phase 12). One page per contract, the calls the editor already makes, and tests that check an API against all of it.

The editor **server** makes every call: the API key and the user's tokens never reach the browser.

## Contracts

| Contract                                                                            | Status in the API                                                                 | Editor without it                                                                                        |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [Settings sync](settings-sync.md)                                                   | to build                                                                          | hosted editors keep account settings on their own disk, per user                                         |
| [Registry of plugins and packages](registry.md)                                     | to build (today's registry holds single-file components and systems, no versions) | the marketplace and the Packages dialog say the registry is not available                                |
| Account plugin list (in [settings sync](settings-sync.md#keys-the-editor-reserves)) | no endpoint of its own: a key of the settings document                            | the list stays on the machine. It also does today for local editors, which do not sign in (see the page) |

Nothing is asked for **per-user project settings** of hosted editors (`local.json` in a local editor): they stay on the hosted editor's disk (`DATA_DIR/settings/project-local/<user>/<project>.json`). A hosted editor therefore needs a **persistent data volume**, shared by its instances if there are several.

## Calls the editor makes today

All with the `Api-Key` header. "Bearer" means `Authorization: Bearer <accessToken>` of the signed-in user.

| Call                              | Auth   | The editor reads                                                                                                             |
| --------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/refresh-token`        | none   | body `{ refreshToken }` → `{ accessToken, refreshToken, tokenExpiresAt }`; `401` signs the user out                          |
| `GET /projects`                   | Bearer | an array of projects: `id`, `code`, `name`, `description`, `gatewayProjectRegistryUrl`, `gatewayProjectRegistryMetadata.dir` |
| `GET /editor/projects/:projectId` | Bearer | the same fields plus `token` (to clone and push the project's git repository)                                                |

A `401` on any authenticated call makes the editor refresh the token pair once and retry.

Sign-in itself is not the editor's: the projects website sets the cookies the hosted editor reads.

## Turning features on

The editor does not guess what is deployed. Whoever runs it lists the features in `API_FEATURES` (comma separated); nothing is on by default.

| `API_FEATURES` | Turns on                                                                      |
| -------------- | ----------------------------------------------------------------------------- |
| `settings`     | account settings through `GET/PUT /users/me/editor-settings` (hosted editors) |
| `registry`     | the marketplace and the Packages dialog read the registry at `API_URL`        |

`REGISTRY_URL` points the editor at a registry elsewhere, and `REGISTRY_DIR` at a folder used as one (tests, working offline).

Probing instead was ruled out: the settings contract answers `404` for "no document yet", which an API without the endpoint answers too.

## Contract tests

The same scenarios run against the editor's own stand-ins (in every test run, so they cannot drift from the contract) and against a real API. They only speak HTTP.

```sh
# The API: authentication, projects, and settings sync when listed in CONTRACT_FEATURES.
CONTRACT_API_URL=https://api.staging.nanoforge.eu \
CONTRACT_API_KEY=… \
CONTRACT_ACCESS_TOKEN=… \
CONTRACT_FEATURES=settings \
CONTRACT_PROJECT_ID=… \
pnpm --filter @nanoforge-dev/editor-server-core test:contract

# The registry (reads only).
CONTRACT_REGISTRY_URL=https://api.staging.nanoforge.eu \
CONTRACT_REGISTRY_ITEM=@scope/name \
pnpm --filter @nanoforge-dev/registry test:contract
```

- Use a **test account**. The settings scenarios write to its document and put it back as it was.
- `CONTRACT_PROJECT_ID` (a project of that account) and `CONTRACT_REFRESH_TOKEN` are optional: their scenarios are skipped without them. Refreshing rotates the refresh token, so the value given stops working afterwards.
- `CONTRACT_REGISTRY_ITEM` is any published item; nothing is published or removed.
- Scenarios: `packages/server-core/test/contract/api-contract.ts` and `packages/registry/test/contract/registry-contract.ts`.

They have only been run against the stand-ins so far.
