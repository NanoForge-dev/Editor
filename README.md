<div align="center">
    <br />
    <p>
        <a href="https://github.com/NanoForge-dev"><img src="https://github.com/NanoForge-dev/Editor/blob/main/.github/logo.png" width="546" alt="NanoForge" /></a>
    </p>
    <br />
    <p>
        <a href="https://www.npmjs.com/package/@nanoforge-dev/editor"><img src="https://img.shields.io/npm/v/@nanoforge-dev/editor.svg?maxAge=3600" alt="npm version" /></a>
        <a href="https://www.npmjs.com/package/@nanoforge-dev/editor"><img src="https://img.shields.io/npm/dt/@nanoforge-dev/editor.svg?maxAge=3600" alt="npm downloads" /></a>
        <a href="https://github.com/NanoForge-dev/Editor/actions/workflows/tests.yml"><img src="https://github.com/NanoForge-dev/Editor/actions/workflows/tests.yml/badge.svg" alt="Tests status" /></a>
        <a href="https://github.com/NanoForge-dev/Editor/actions/workflows/e2e.yml"><img src="https://github.com/NanoForge-dev/Editor/actions/workflows/e2e.yml/badge.svg" alt="E2E status" /></a>
        <a href="https://github.com/NanoForge-dev/Editor/commits/main"><img src="https://img.shields.io/github/last-commit/NanoForge-dev/Editor.svg?logo=github&logoColor=ffffff" alt="Last commit" /></a>
        <a href="https://github.com/NanoForge-dev/Editor/graphs/contributors"><img src="https://img.shields.io/github/contributors/NanoForge-dev/Editor.svg?maxAge=3600&logo=github&logoColor=fff&color=00c7be" alt="Contributors" /></a>
    </p>
</div>

## About

This repository contains the Editor of NanoForge. Check [releases][github-releases] to see versions of the Editor. Nanoforge is a powerful game engine for web browser.

## Repository layout

The editor is a pnpm + turbo monorepo. The rewrite plan is [`docs/rewrite-plan.md`](docs/rewrite-plan.md), design decisions are in [`docs/adr`](docs/adr), plugin specs in [`docs/specs`](docs/specs), and the user documentation and plugin guide in [`docs/docs`](docs/docs).

| Path          | Content                                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/editor` | The SvelteKit shell and Bun server published as `@nanoforge-dev/editor`                                                                                           |
| `packages/*`  | Core editor packages (`kernel`, `sdk`, `rpc`, `protocol`, `history`, `settings`, `layout`, `ui`, `project`, `code`, `meta`, `runtime`, `server-core`, `registry`) |
| `plugins/*`   | Built-in editor plugins (`nanoforge.manifest.json`, type `plugin`)                                                                                                |
| `tooling/*`   | Plugin build tooling (`vite-plugin`) and the example plugin the e2e tests load                                                                                    |
| `examples/*`  | A game to try the editor on (`breakout`) and a standalone plugin (`counter-plugin`)                                                                               |

## Develop

Prerequisites:

- Node 26 and pnpm 12 (`corepack enable`);
- Bun 1.3, which runs the editor server;
- Google Chrome or Chromium for the browser tests (`CHROME=/path/to/chrome`) and the e2e tests;
- to play games in the editor: a built checkout of [Engine](https://github.com/NanoForge-dev/Engine) next to this repository (`../engine`, or set `NANOFORGE_ENGINE`), and optionally a built [CLI](https://github.com/NanoForge-dev/CLI) (`NANOFORGE_CLI`).

```bash
pnpm install
pnpm turbo build --filter=@nanoforge-dev/editor...   # the editor and every plugin it bundles
pnpm example                                         # opens examples/breakout on http://127.0.0.1:4800
pnpm dev                                             # editor and built-in plugins in watch mode
```

Checks: `pnpm lint`, `pnpm typecheck`, `CHROME=… pnpm test`. The e2e tests run against the production build: build first, then `cd apps/editor && npx playwright test`.

## Usage

To use Nanoforge Editor, please refer to the [CLI documentation][cli-source] !

First, install the Editor :

```bash
npm install -g @nanoforge-dev/cli
```

And then start the editor :

```bash
nf editor [path]
```

## Contributing

Please read through our [contribution guidelines][contributing] before starting a pull request. We welcome contributions of all kinds, not just code! If you're stuck for ideas, look for the [good first issue][good-first-issue] label on issues in the repository. If you have any questions about the project, feel free to ask them on [Discussions][discussions]. Before creating your own issue or pull request, always check to see if one already exists! Don't rush contributions, take your time and ensure you're doing it correctly.

## Help

If you don't understand something in the documentation, you are experiencing problems, or you just need a gentle nudge in the right direction, please ask on [Discussions][discussions].

[contributing]: https://github.com/NanoForge-dev/Editor/blob/main/.github/CONTRIBUTING.md
[discussions]: https://github.com/NanoForge-dev/Editor/discussions
[cli-source]: https://github.com/NanoForge-dev/CLI
[github-releases]: https://github.com/NanoForge-dev/Editor/releases
[good-first-issue]: https://github.com/NanoForge-dev/Editor/contribute
