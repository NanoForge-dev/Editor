# Editor documentation pages

The pages of the documentation site for the editor (Mintlify `.mdx`). The site itself is the `docs` repository: copy these folders into its `docs/` and add the navigation below to its `docs.json`.

```json
{
  "group": "Editor",
  "pages": [
    "docs/getting-started/introduction",
    "docs/getting-started/create-your-first-project",
    {
      "group": "Using the editor",
      "pages": [
        "docs/editor/overview",
        "docs/editor/layout",
        "docs/editor/files",
        "docs/editor/code-editor",
        "docs/editor/entities",
        "docs/editor/components",
        "docs/editor/systems",
        "docs/editor/scenes",
        "docs/editor/play",
        "docs/editor/settings",
        "docs/editor/git",
        "docs/editor/plugins-and-packages"
      ]
    },
    {
      "group": "Plugins",
      "pages": [
        "docs/plugins/overview",
        "docs/plugins/create-your-first-plugin",
        "docs/plugins/manifest",
        "docs/plugins/sdk",
        "docs/plugins/extension-points",
        "docs/plugins/widgets-and-styles",
        "docs/plugins/settings",
        "docs/plugins/history",
        "docs/plugins/code-and-codegen",
        "docs/plugins/engine-libs"
      ]
    }
  ]
}
```

- Screenshots are in `images/`, taken on the engine's pong-network example. `create-project.png` and `init-project.png` show the projects website and were kept from the previous documentation.
- The example the plugin guide walks through is `examples/counter-plugin` in this repository.
