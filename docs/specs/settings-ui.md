# Settings UI plugin (`@nanoforge/settings-ui`)

Requirements session: 2026-09-27. Built-in plugin in `plugins/settings-ui`, the last of phase 9.

## Dialog

- A large modal, like IntelliJ: _File › Settings…_ or `Ctrl+Alt+S` (also `Ctrl+,`).
- Left: the category tree (from each setting's `category`, e.g. `Editor/Code editor/Saving`), plus the pages _Plugins_, _Import & export_ and, when there are any, _Sync conflicts_.
- Right: the settings of the selected category and its subcategories. A search box searches titles, descriptions, keys and tags across every category.
- Changes are pending until **Apply** or **OK**; **Cancel** drops them. A marker shows pending changes and modified settings (not at their default).

## Scopes, per setting

- Each setting shows its **effective value**. A small **scope menu** chooses where a change is written: _Account_, _This machine_, _Project_ or _Project (only me)_, among the scopes the setting allows. It defaults to where the value comes from, else the account (when signed in) or this machine.
- An **inspect** popover lists the value in each scope and the effective one, with a reset per scope.

## Controls

The control comes from the setting's schema:

- boolean: switch;
- enum: select;
- number: number input with its bounds;
- string: text input;
- string list: one entry per line;
- anything else: JSON.

Invalid values are shown inline and are not applied.

## Pages

- **Plugins**: installed plugins (name, version, source, status) with a switch to enable or disable each (`plugins.disabled`). Changes take effect after a reload, and a _Reload now_ button is offered. It replaces the temporary Plugins panel.
- **Import & export**: export a scope to a `.json` file; import a file into a scope with a preview (added, changed, unknown, rejected keys) before applying.
- **Sync conflicts**: after offline edits, each conflicting key shows the value from this device and the one from the account; pick one. A notification points here when a conflict appears.
- **Account sync status** in the dialog header: synced, syncing, pending, offline, conflict or error.

## Edit as JSON

_Edit as JSON_ opens the project's `.nanoforge/editor/settings.json` (Project scope) or `local.json` (Project (only me), local editors) in the code editor. A JSON schema generated from every setting gives completion and validation. The schema is contributed through a new `JSON_SCHEMAS` extension point of the SDK, which the code editor applies to Monaco.

## Core additions

- `AccountSyncToken` (the account store: status and conflicts) and `PluginHostToken`, in the SDK.
- `JSON_SCHEMAS` (`{ fileMatch, schema }`), applied by the code editor.

## Done when

- Browser tests:
  - open with the shortcut;
  - find a setting by search;
  - change it and apply;
  - change it and cancel;
  - write it to another scope and see it in inspect;
  - reset a scope;
  - disable a plugin;
  - export and import with a preview;
  - edit `settings.json` as JSON with completion.
