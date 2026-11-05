<div align="center">
    <br />
    <p>
        <a href="https://github.com/NanoForge-dev"><img src="https://github.com/NanoForge-dev/Editor/blob/main/.github/logo.png" width="546" alt="NanoForge" /></a>
    </p>
    <br />
    <p>
        <a href="https://www.npmjs.com/package/@nanoforge-dev/editor-sdk"><img src="https://img.shields.io/npm/v/@nanoforge-dev/editor-sdk.svg?maxAge=3600" alt="npm version" /></a>
        <a href="https://www.npmjs.com/package/@nanoforge-dev/editor-sdk"><img src="https://img.shields.io/npm/dt/@nanoforge-dev/editor-sdk.svg?maxAge=3600" alt="npm downloads" /></a>
        <a href="https://github.com/NanoForge-dev/Editor/actions/workflows/tests.yml"><img src="https://github.com/NanoForge-dev/Editor/actions/workflows/tests.yml/badge.svg" alt="Tests status" /></a>
        <a href="https://github.com/NanoForge-dev/Editor/commits/main/packages/sdk"><img src="https://img.shields.io/github/last-commit/NanoForge-dev/Editor.svg?logo=github&logoColor=ffffff&path=packages%2Fsdk" alt="Last commit" /></a>
        <a href="https://github.com/NanoForge-dev/Editor/graphs/contributors"><img src="https://img.shields.io/github/contributors/NanoForge-dev/Editor.svg?maxAge=3600&logo=github&logoColor=fff&color=00c7be" alt="Contributors" /></a>
    </p>
</div>

## About

`@nanoforge-dev/editor-sdk` is part of the NanoForge Editor.

Public API for NanoForge editor plugins.

Three entries: `@nanoforge-dev/editor-sdk` (services, commands, extension points), `@nanoforge-dev/editor-sdk/ui` (widgets, the component kit) and `@nanoforge-dev/editor-sdk/worker` (code analyzers and transformers, which need `ts-morph`). The editor provides all three at runtime: build plugins with [`@nanoforge-dev/editor-vite-plugin`](https://www.npmjs.com/package/@nanoforge-dev/editor-vite-plugin), which points their imports at the editor's own copy. The published `ui` entry holds the types only: its exports throw when used outside the editor, so unit tests mock it (`vi.mock('@nanoforge-dev/editor-sdk/ui')`).

## Installation

**Node.js 26 or newer is required.**

```sh
npm install @nanoforge-dev/editor-sdk
yarn add @nanoforge-dev/editor-sdk
pnpm add @nanoforge-dev/editor-sdk
bun add @nanoforge-dev/editor-sdk
```

## Links

- [GitHub][source]
- [npm][npm]

## Contributing

Before creating an issue, please ensure that it hasn't already been reported/suggested, and double-check the
[documentation][documentation].
See [the contribution guide][contributing] if you'd like to submit a PR.

## Help

If you don't understand something in the documentation, you are experiencing problems, or you just need a gentle nudge in the right direction, please don't hesitate to ask questions in [discussions][discussions].

[documentation]: https://github.com/NanoForge-dev/Editor
[discussions]: https://github.com/NanoForge-dev/Editor/discussions
[source]: https://github.com/NanoForge-dev/Editor/tree/main/packages/sdk
[npm]: https://www.npmjs.com/package/@nanoforge-dev/editor-sdk
[contributing]: https://github.com/NanoForge-dev/Editor/blob/main/.github/CONTRIBUTING.md
