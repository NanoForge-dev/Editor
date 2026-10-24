# Counter

A NanoForge editor plugin (`@acme/counter`).

- `nanoforge.manifest.json`: what the plugin adds to the editor (a panel, a command, a menu entry, a setting).
- `src/index.ts`: `activate`, run when the panel is first shown or the command first runs.
- `src/Panel.svelte`: the panel.

## Run it in the editor

```sh
pnpm install
pnpm dev                                  # rebuilds dist/ on every change
DEV_PLUGINS=$(pwd) nf editor <a project>  # in another terminal: the editor reloads the plugin
```

The Counter panel opens in the bottom right dock. _View › Panels › Counter_ shows it again once closed, and _Edit › Add to the counter_ runs its command.

## Install it without the dev mode

Build it (`pnpm build`), then copy `dist/` to `~/.nanoforge/editor/plugins/@acme/counter` (every project) or to `<project>/.nanoforge/plugins/@acme/counter` (that project).

The plugin authoring guide has the rest: the manifest, the SDK, extension points, settings, history.
