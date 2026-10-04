# ADR 0002 — Editor server: Bun RPC server + static SvelteKit UI

- Status: accepted (phase 2)
- Date: 2026-09-26

## Context

The previous editor ran all server logic through SvelteKit form actions and hooks
(`svelte-adapter-bun`). The rewrite needs:

- a typed RPC API shared with plugins' server entries;
- a WebSocket for file changes, model updates and dev plugin reloads;
- plugin file serving.

`nf editor` must still start one process (`bun dist/index.js`).

## Decision

- **UI**: SvelteKit builds a static single-page app (`@sveltejs/adapter-static`, SPA fallback,
  `ssr = false`). SvelteKit only handles routing and rendering.
- **Server**: `apps/editor/server/main.ts` runs `Bun.serve` around `createEditorServer`
  (`packages/server-core`). The server is transport-agnostic and testable in Node. It serves:
  - `POST /rpc/<namespace>.<method>`: typed calls, zod-validated, binary-safe JSON;
  - `GET /rpc/ws`: one multiplexed WebSocket for stream subscriptions;
  - `GET /plugins/<source>/@<scope>/<name>/<version>/*`: plugin files;
  - the built UI with an SPA fallback, and `/healthz`.
- **Dev**: `vite dev` starts the Bun server (`bun --watch`) through a Vite plugin and proxies
  `/rpc`, `/rpc/ws` and `/plugins` to it.
- **Contracts**: `packages/protocol` holds the contracts shared by client and server. Plugins
  implement their own under the namespace `plugin.<name>`.

## Security

- Every RPC call and WebSocket upgrade is checked against the `Origin` header, so a web page on
  another origin cannot drive a local editor. OFFLINE editors bind to `127.0.0.1` by default.
- Project paths are jailed to `FS_ROOT`, and file paths to the project root, including through
  symlinks. Deletes go to `.nanoforge/editor/trash`.
- **Config loading**:
  - OFFLINE executes `nanoforge.config.*` with `unrun`, like the CLI does. Everything but Node
    built-ins is bundled (unrun imports from `<cwd>/node_modules/.unrun`), and
    `@nanoforge-dev/config` is a virtual module, so fresh clones load.
  - ONLINE never executes project code: configs are read statically, literal values only.
- ONLINE sessions reuse the `accessToken`/`refreshToken` cookies set by the NanoForge projects
  website. The API client refreshes them through `POST /auth/refresh-token`.

## Consequences

- SvelteKit server features (load functions, form actions) are not used.
- Any server feature is an RPC contract, which plugins can also provide.
- Hosted (ONLINE) deployments still run `nf` CLI commands on project code, as the previous
  editor did. They must isolate projects (containers) until a sandbox exists.
