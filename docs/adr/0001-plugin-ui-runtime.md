# ADR 0001 — Plugin UI runtime: shared modules through a build-time rewrite

- Status: accepted (phase 1.1 spike, GO)
- Date: 2026-09-26

## Context

Editor plugins are built separately from the editor (bundled, marketplace or local-dev plugins)
and render Svelte 5 widgets inside the editor. A compiled Svelte component imports
`svelte/internal/client`. If a plugin bundled its own copy of the runtime, its widgets would not
share reactivity, contexts or effect scheduling with the host.

The plan's first idea was an **import map** that points `svelte/*` to the host's copy. It does
not work reliably: in a SvelteKit/Vite production build, the runtime is inlined into hashed
chunks with no stable URL. In dev it is served from `.vite/deps` with a version hash. Shims
re-exporting the runtime would need the exact export names of every module.

## Decision

Plugins are built with `@nanoforge-dev/editor-vite-plugin` (`tooling/vite-plugin`):

- Shared modules (`SHARED_MODULES`: the Svelte client modules and `@nanoforge-dev/editor-sdk`)
  are externalized.
- In `renderChunk`, every import of a shared module is rewritten into a lookup:
  `globalThis.__nanoforge_editor_shared__.require('<specifier>')`. This covers namespace,
  named, default and dynamic imports. Re-exports are rejected.
- Side-effect-only modules the host already evaluated (`disclose-version`, `flags/tracing`) are
  dropped.
- Modules that would flip global runtime flags (`flags/legacy`, `flags/async`) are a build
  error, so **plugins must compile in runes mode**.

The host fills a `SharedModuleRegistry` (kernel) with its own module namespaces and installs it
before importing any plugin (`apps/editor/src/lib/plugin/shared-modules.ts`). Plugin output
stays plain ESM with relative chunks, and nothing depends on the host's chunk names.

## Verification

_Update (phase 5): the spike route, fixture and check script were replaced by the end-to-end test `apps/editor/e2e/workbench.spec.ts` ("runs a local plugin built against the shared runtime"), which loads `tooling/example-plugin` in the real editor._

`tooling/spike-plugin` (an externally built widget) is rendered by `/__spike` as a child
component of a host component. `apps/editor/e2e/plugin-runtime.check.mjs` checks all of these,
in **dev (vite) and prod (bun build)**, and both pass:

- a context set by the host is readable by the plugin (`getContext`);
- the host's `$state` passed as a prop drives the plugin's `$derived`, and the plugin's mutations
  are seen by the host;
- the plugin's local `$state` works;
- scoped CSS applies;
- there are no console errors.

## Consequences

- Compiled Svelte output depends on the runtime's internal API. A plugin compiled with a newer
  Svelte than the host may call internals the host lacks. The build will record the Svelte
  version in the built manifest, and the plugin host will require
  `same major && compiled <= host` (phase 1.13).
- Plugins must be built with the NanoForge vite plugin (`nf create plugin` sets this up).
- Fallback B from the plan (framework-agnostic `mount(el)` widgets) stays supported for
  non-Svelte widgets. It is not needed as a fallback.
