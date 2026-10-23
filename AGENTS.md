# Editor

## Role

This repo contains the NanoForge Editor, a game engine for the browser. It is the web application (started via `nf editor [path]` from the CLI) that lets you create, open, and visually edit a NanoForge project: scene management, ECS (Entity-Component-System) entities, components and systems, content browser, built-in code editor, and project export/build. It runs in two modes: `OFFLINE` (local execution on the dev's machine) or `ONLINE` (connected to the NanoForge API).

## Tech Stack

- **Language**: TypeScript (Node.js 25)
- **Front-end framework**: [SvelteKit](https://kit.svelte.dev) (Svelte 5) — the application is a single full-stack project (server routes + client pages)
- **Runtime / build**: [Bun](https://bun.sh) as the runtime (`bun --bun run vite ...`) and SvelteKit deployment adapter (`svelte-adapter-bun`), [Vite](https://vite.dev) bundler
- **CSS**: [UnoCSS](https://unocss.dev) (atomic CSS, Tailwind-like `wind4` preset) + additional [Tailwind](https://tailwindcss.com) utilities, UI components based on [shadcn-svelte](https://shadcn-svelte.com) (`nova` style, see `components.json`) and [bits-ui](https://bits-ui.com)
- **Built-in code editor**: Monaco Editor
- **i18n**: [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) (inlang project, translation files `messages/en.json`, `messages/fr.json`)
- **Forms / validation**: `sveltekit-superforms` + `zod`, `formsnap`
- **Client-side data fetching**: `@tanstack/svelte-query`
- **Tests**: Vitest (unit tests, including Svelte tests via `vitest-browser-svelte` + headless Playwright/Chromium browser for components), Playwright for e2e tests (`e2e/demo.test.ts`)
- **Package manager**: pnpm (version catalogs via `pnpm-workspace.yaml`)
- **Containerization**: Docker (`Dockerfile`)
- **Notable external dependency**: `@nanoforge-dev/ecs-lib` (`catalog:core`), used to manipulate scenes/entities/components/systems in the editor

## Project Structure

```
src/
├── app.html / app.css / app.d.ts    # SvelteKit shell
├── hooks.server.ts / hooks.ts         # SvelteKit hooks (session, global middlewares)
├── routes/                            # SvelteKit pages and endpoints (file-based routing)
│   ├── +page.svelte / +page.server.ts   # home page / project selection
│   ├── dashboard/                         # dashboard
│   ├── load/                                # loading a project (local or remote)
│   ├── actions/project/                       # server actions (archive, fs, library, loader, package, save)
│   ├── fs/                                      # server file endpoints (archive, build, project)
│   └── components/                                # page-specific components (dialogs, forms, header...)
└── lib/
    ├── client/                        # logic executed client-side (browser)
    │   ├── ecs/                          # editor-side ECS model: asset, component, library, scene, system
    │   ├── action/                         # UI-triggered actions + associated repositories
    │   ├── event/                            # event bus (events, listeners, types)
    │   ├── loader/                             # loading the game/project into the editor
    │   ├── project / project-loader/             # management of the open project
    │   ├── sync-file-system/                       # file system synchronization
    │   └── utils/{file-system,indexed-db}           # client utilities (file access, IndexedDB)
    ├── server/                        # logic executed server-side (SvelteKit server-side)
    │   ├── api/                           # client for the NanoForge API (repositories, middlewares, types)
    │   ├── cli/                             # bridge to the `nf` binary (the CLI drives build/dev of the edited project)
    │   ├── file-system/                       # disk access (reading/writing projects)
    │   ├── git/                                 # server-side git operations
    │   ├── project/{library,loader,package,save} # management of persisted projects
    │   ├── session/project/                         # user session tied to a project
    │   └── utils/{cookies,request-handler,validators}
    ├── components/                    # reusable Svelte components
    │   ├── ui/                            # shadcn-svelte primitives (button, dialog, form, select, tabs...)
    │   ├── Widget/                          # editor's main widgets: ecs-tree, entity-inspector,
    │   │                                       content-browser, CodeEditor, EditorGame, OutputLog
    │   ├── Panel / Tabs / Menu                # editor's panel/tab/menu system
    │   ├── dialogs / forms / marketplace       # dialogs, forms, component marketplace
    └── utils/                         # generic utilities (http, types)

messages/                     # translations (en.json, fr.json) for Paraglide
project.inlang/                # inlang project config (i18n)
docs/docs/
├── getting-started/            # introduction, first project
└── editor/                       # functional guides: entities, components, systems, viewport, export
e2e/demo.test.ts               # Playwright e2e test
```

## Main Commands

```bash
pnpm install
cp .env.example .env            # configure NODE_ENV, PUBLIC_MODE (OFFLINE/ONLINE), API_URL, API_KEY, FS_ROOT, ARCHIVE_ROOT...

pnpm run dev            # bun --bun run vite dev
pnpm run build             # bun --bun run vite build
pnpm run preview              # bun --bun run vite preview

pnpm run check                   # svelte-kit sync && svelte-check (Svelte type checking)
pnpm run check:watch

pnpm run lint                        # prettier --check + eslint
pnpm run format                        # prettier --write + eslint --fix

pnpm run test                             # unit + e2e
pnpm run test:unit                           # vitest (vite.config.ts), "client" (browser) and "server" (node) projects
pnpm run test:e2e                              # vitest (vite.config.e2e.ts) — also uses Playwright for e2e (playwright.config.ts)
pnpm run test:coverage

pnpm run changelog    # git-cliff
pnpm run release         # @favware/cliff-jumper
```

## Conventions

- **OFFLINE / ONLINE mode**: the `PUBLIC_MODE` variable switches the editor's behavior between pure local execution and execution connected to the NanoForge API (`API_URL`, `API_KEY` required in ONLINE mode).
- **Code style**: shared config `@nanoforge-dev/utils-eslint-config` / `@nanoforge-dev/utils-prettier-config`, plus `eslint-plugin-svelte` and `prettier-plugin-svelte` for `.svelte` files, import sorting via `@trivago/prettier-plugin-sort-imports`.
- **Path aliases**: defined in `svelte.config.js` (`@utils/*`, `@utils-client/*`, `@utils-server/*`) to avoid deep relative imports between `lib/utils`, `lib/client/utils` and `lib/server/utils`.
- **UI components**: generated/aligned with the shadcn-svelte convention (see `components.json`, `nova` style, `neutral` base color), with theme variables in `oklch()` defined in `src/app.css` and consumed by UnoCSS (`uno.config.ts`).
- **Commits / releases**: Conventional Commits (Commitlint + Husky + lint-staged), changelog via `git-cliff`, versioning via `@favware/cliff-jumper`, with a dedicated `alpha-release.yml` workflow for alpha releases in addition to `release.yml` and `pre-release.yml`.
- **Svelte tests**: explicit separation between "client" tests (run in a real headless browser via `vitest-browser-svelte` + Playwright, files `*.svelte.{test,spec}.ts`, which exclude `lib/server`) and "server" tests (classic Node environment).
- **Deployment**: `nanoforge.yaml` at the root describes the Kubernetes deployment of the editor itself (image, Traefik route `editor.nanoforge.eu`, public URL config) — the editor is deployed with the same tools as the projects it is used to create.
