# Performance (phase 13.3)

Measured on 2026-10-02, on the production build, with Chrome on the development machine. Numbers are medians of 5 cold runs (a new browser context each time) on the engine's pong-network example, with the range in brackets.

## How to measure

```sh
# Bundle analysis: the heaviest modules of each big chunk, and how the TypeScript compiler got
# into a chunk if it did (it belongs to the code worker only).
cd apps/editor && ANALYZE=1 npx vite build

# Startup: scripts loaded, code worker cold start, layout renders.
pnpm turbo build --filter=@nanoforge-dev/editor...
cd apps/editor && BENCH=1 E2E_WORKSPACE=.workspace-agent CHROME=/usr/bin/google-chrome-stable \
  NANOFORGE_ENGINE=<engine checkout> npx playwright test --reporter=line
# BENCH_STRICT=1 fails the run when the code worker's cold start is over 1.5 s.

# The layout model alone.
pnpm --filter @nanoforge-dev/editor-layout bench
```

The benchmarks are not part of the test suite: they print numbers and do not fail on a slow machine.

## Bundle

**Fixed: the TypeScript compiler was in the page's own script.** The page chunk of the editor was 6.96 MB because the main thread imported one constant from the code engine and one helper from the meta package, and both modules import ts-morph. The compiler was therefore downloaded and parsed twice: once in the page (unused), once in the code worker.

| Script                                                                            | Before         | After                                      |
| --------------------------------------------------------------------------------- | -------------- | ------------------------------------------ |
| Editor page chunk (`nodes/2.*.js`)                                                | 6 955 KiB      | 65 KiB                                     |
| Scripts of the app loaded at startup (before: from the chunk sizes, not measured) | about 14.4 MiB | 7.4 MiB (6.7 MiB of it is the code worker) |
| Plugin scripts loaded at startup                                                  | 394 KiB        | 394 KiB                                    |

- The meta package has a compiler-free entry (`@nanoforge-dev/editor-meta/pure`: format, hashes, owner types), and the code package's main entry only exports types and compiler-free values. The engine is reached through `@nanoforge-dev/editor-code/engine` and `/worker`.
- `ANALYZE=1` prints the import chain if the compiler ever gets back into a page chunk.
- What remains at startup: the kit and workbench (299 KiB), the kernel and services (156 KiB), and the code worker (6.9 MiB, loaded in the background when something first asks for code analysis).

## Lazy loading of plugins

Each plugin is its own bundle, fetched when one of its activation events fires.

| Loaded when a project opens                                                                                                            | Loaded on demand                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| file-manager, viewport, ecs, console, command-palette, git, history-panel, settings-ui (394 KiB together; the largest is ecs, 104 KiB) | code-editor (Monaco, 15 MB on disk, with one chunk per language): on the first Script screen or opened file |
|                                                                                                                                        | inspectors: when one of its panels is first shown                                                           |
|                                                                                                                                        | packages: when _File › Packages…_ first runs                                                                |

The plugins loaded at startup are there because they show something at once (a default dock, a status bar item, a menu). Making more of them lazy would save little (under 400 KiB in all) and changes activation order, which has caused focus races before: left as is.

## Code worker cold start

Budget: **under 1.5 s** on pong-network.

| Step                                                        | Time                   |
| ----------------------------------------------------------- | ---------------------- |
| Worker created → compiler loaded, first call answered       | 373 ms (366–391)       |
| Worker created → project's code files mirrored (cold start) | **491 ms (461–543)**   |
| Page opened → components listed in the Components panel     | 1 512 ms (1 448–2 006) |

The steps are marks in the browser's performance timeline (`nf:code:created`, `nf:code:ready`, `nf:code:mirrored`), so they can be read in DevTools too. The last row includes the page load, the plugins, the worker and the extraction of every component and system.

## Layout

In the page: switching screens (the workbench renders again, the docks stay) takes **21 ms** from the click to the second frame after it (4–49 ms). The workbench is shown 441 ms after the page starts loading (387–642).

The layout model, on 120 docks and 8 screens (a real editor has about 20 widgets):

| Operation                  | Mean    |
| -------------------------- | ------- |
| Compose the default layout | 0.05 ms |
| 200 splitter resizes       | 0.01 ms |
| 120 tab activations        | 0.03 ms |
| 120 moves between slots    | 0.10 ms |
| Serialize and read back    | 0.06 ms |

The model is nowhere near a frame's budget: layout cost is rendering, not computing.

## Not done

- The code worker script is 6.9 MiB (ts-morph and the compiler). Shrinking it means replacing ts-morph with the bare compiler API, a rewrite of the engine.
- No budget is enforced in CI: the numbers depend on the machine.
