# Editor settings sync — NanoForge API contract

Status: **proposed**, to be implemented by `api.nanoforge.eu`. The editor already ships a client
(`ApiAccountBackend` in `packages/server-core`) and a mock implementing this contract
(`packages/server-core/test/mocks/nanoforge-api.ts`). Contract tests check an API against this
page: see [README](README.md#contract-tests).

## Model

Each user has **one editor settings document**:

```json
{ "revision": "42", "values": { "editor.locale": "fr", "history.limit": 200 } }
```

- `values` is a flat JSON object: keys are setting ids (`<namespace>.<name>`), values are any
  JSON. The API does not interpret keys or values; the editor validates them.
- `revision` is an opaque string, changed on every write. It is `null` before the first save.
- Limits: at most **2000 keys** and **256 KiB** of serialized `values`. Larger writes get `413`.

## Endpoints

Both endpoints need the usual `Api-Key` header and the user's `Authorization: Bearer
<accessToken>`. Expired tokens get `401`; the editor then calls `POST /auth/refresh-token` once
and retries.

### `GET /users/me/editor-settings`

| Status | Body                                                                          |
| ------ | ----------------------------------------------------------------------------- |
| `200`  | `{ "revision": string, "values": object }`                                    |
| `404`  | no document yet; the editor treats it as `{ "revision": null, "values": {} }` |

### `PUT /users/me/editor-settings`

Request body:

```json
{ "baseRevision": "42", "values": { "...": "..." } }
```

Replaces the whole document **only if** the stored revision equals `baseRevision` (`null` means
"no document yet"). The comparison is exact.

| Status | Body                                               | Meaning                                      |
| ------ | -------------------------------------------------- | -------------------------------------------- |
| `200`  | `{ "revision": string }`                           | saved, new revision                          |
| `409`  | `{ "revision": string \| null, "values": object }` | `baseRevision` is outdated: current document |
| `413`  | `{ "message": string }`                            | limits exceeded                              |
| `400`  | `{ "message": string }`                            | malformed body (`values` not an object…)     |

The `409` body lets the editor merge without another round trip. It does a per-key
three-way merge against the last synced base, retries the `PUT` with the new revision, and asks
the user about keys changed on both sides.

## Editor behavior (for reference)

- Edits apply locally at once and are kept in IndexedDB until the API accepts them (offline
  queue). Pushes are debounced (500 ms) and retried with backoff while the API is unreachable.
- Settings declared with `sync: false` never leave the machine.
- **Offline editors** (`PUBLIC_MODE=OFFLINE`) store the same document in the editor data dir
  (`~/.nanoforge/editor/settings/accounts/`), with the same revision semantics.
- Other tabs of the same user are notified through the editor server (`settings.accountChanges`
  stream) and pull the new revision.

## Keys the editor reserves

The API does not interpret them; they are listed so nobody is surprised by them.

- `plugins.account`: the plugins the user installed "for me" from the marketplace, as `{ "@scope/name": "<range>" }`. This is the **account plugin list**: it needs no endpoint of its own. A local editor that lacks a plugin of the list offers to install it. Local editors have no sign-in and keep the account document on their machine, and hosted editors install no plugins: the list only travels between machines once local editors sign in and sync account settings with the API, which is not built.
- `plugins.disabled`: names of the plugins the user turned off.
- `keymap.overrides`, `keymap.preset`: the user's keyboard shortcuts.

## Until the API has it

The editor calls these endpoints only when `settings` is listed in its `API_FEATURES` ([README](README.md#turning-features-on)). Without it, a hosted editor keeps the same document on its own disk, per user, and the Settings dialog says "Saved on this editor".

## Future extensions (not required yet)

- Server push (websocket/SSE) of revision changes across devices. Until then, editors pull on
  startup, on reconnect and after their own saves.
