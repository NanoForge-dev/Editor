# Examples

## `breakout`

A breakout made of scenes (`@nanoforge-dev/scene`, engine branch `feat/scene`): a menu, three levels under a game scene, a pause menu over any level, end screens, and scene vars that follow their scenes. `NANOFORGE_ENGINE=../engine-scene pnpm example breakout` starts the editor on it. See [`breakout/README.md`](breakout/README.md).

## `counter-plugin`

A standalone editor plugin (`@acme/counter`): a panel with a counter, a command in the Edit menu, a setting, and additions you can undo. It is what `nf create plugin --name @acme/counter` writes (then formatted with this repository's Prettier, which lays out two JSON files differently), kept here as the reference the plugin guide (`docs/docs/plugins`) walks through. It is not part of the workspace: copy the folder anywhere, or push it as a repository of its own.

### Building it before the SDK is published

`@nanoforge-dev/editor-sdk` and `@nanoforge-dev/editor-vite-plugin` are not on npm yet, so `pnpm install` cannot fetch them. Link them from a checkout of this repository instead (checked on a clean copy of the example):

1. In the editor repository, once:

   ```sh
   pnpm install
   pnpm turbo build --filter=@nanoforge-dev/editor-sdk --filter=@nanoforge-dev/editor-vite-plugin
   ```

2. In the plugin's `package.json`, point the two packages at that checkout:

   ```json
   "devDependencies": {
     "@nanoforge-dev/editor-sdk": "link:/path/to/editor/packages/sdk",
     "@nanoforge-dev/editor-vite-plugin": "link:/path/to/editor/tooling/vite-plugin"
   }
   ```

3. Then, in the plugin's folder: `pnpm install`, `pnpm build`, and `pnpm typecheck`.

Put the version ranges back (`^1.0.0`) once the packages are published.

### Trying it in the editor

```sh
DEV_PLUGINS=<path to counter-plugin> nf editor <project>
```

In the e2e editor of this repository: `E2E_EXTRA_PLUGINS=<path to counter-plugin>` adds it next to the example plugin the tests load.
