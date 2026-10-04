# Command palette plugin (`@nanoforge/command-palette`)

Requirements session: 2026-10-01. Built-in plugin in `plugins/command-palette`, the second of phase 11. It brings the palette and the **Keyboard shortcuts** page of Settings.

## Palette

One dialog with a search box. The first character picks what it searches:

| Typed          | Searches                 | Shortcut       |
| -------------- | ------------------------ | -------------- |
| `>`            | commands                 | `Ctrl+Shift+P` |
| nothing        | project files, by name   | `Ctrl+P`       |
| `:12`, `:12:4` | a line of the open file  | `Ctrl+G`       |
| `@`            | symbols of the open file | `Ctrl+Shift+O` |

- _View › Command palette…_ opens it too. A hint under the box lists the prefixes.
- **Fuzzy search**: letters in order, not necessarily adjacent. Matches at the start of words rank first, and the matched letters are highlighted.
- Arrows move, Enter runs, Escape closes. Clicking a row runs it.
- The palette closes and gives the focus back to where it was **before** running anything, and what it lists is decided from the context at the moment it opened. So _Close panel_ closes the panel you were in, and commands that depend on the focus see the right one.

### Commands

- Every **action** available now:
  - commands with a title whose `when` clause is true;
  - menu entries that run a command with arguments (_View: Console_, _View: Game_, a saved layout…), named after their menu entry.
- Commands that need arguments and have no menu entry are left out (`palette: false` in their metadata).
- A row shows `Category: Title` and the action's shortcut.
- **Recent first**: with an empty search, the actions run last from the palette are on top (the last 10, kept in this browser). When searching, a recent action wins a tie.
- Commands of plugins that are not active yet are listed from their manifest; running one activates the plugin.

### Files

- Project files by path (the same files the Files panel shows; dependency and build folders are left out).
- With an empty search: the open documents first.
- Enter opens the file with its editor.

### Go to line, symbols

- `:line` or `:line:column` moves the cursor in the file of the active code editor.
- `@` lists the symbols of that file (classes, functions, methods, variables…) with their kind and line, from the code worker.
- With no file open, the palette says so.

## Keyboard shortcuts (Settings page)

A page of the Settings dialog, _Keyboard shortcuts_. Its changes are pending until **Apply** or **OK**, like the rest of the dialog. `settings.open` with the page `keymap`, and the command _Open keyboard shortcuts_, go straight to it.

### The list

- One row per action (the same actions as the palette), with its shortcuts and where each comes from: _Default_, the preset's name, or _You_.
- **Search** by title, command id or shortcut (`ctrl+s`). Filters: _Changed_ (only what you changed) and _Conflicts_.
- Per action: **Add shortcut**, **Reset** (back to the defaults and the preset).
- Per shortcut: **Change**, **Edit condition**, **Remove**.

### Recording a shortcut

- A dialog captures what you press. A second keystroke within the same recording makes a **chord** (`Ctrl+K Ctrl+S`); two strokes at most. While it records, the editor's shortcuts are off, so any key can be captured (except the few a browser keeps for itself, like `Ctrl+W` or `Ctrl+T`).
- The platform's main modifier is saved as `Mod` (Ctrl, or Cmd on macOS), so a shortcut saved to the account works on both.
- An action can have **several shortcuts**.
- **Condition**: an optional `when` clause (`runtime.active`, `!textInputFocus`…), checked as you type.
- **Conflicts**: the dialog names the other action when the shortcut is already used where the conditions overlap (same condition, or one of them has none), or when it hides or is hidden by a chord (`Ctrl+K` against `Ctrl+K S`). You can keep both, **replace** (the other action loses that shortcut), or cancel. Conflicts involving your changes are marked in the list.

### Presets

- A **preset** is a named set of shortcuts applied on top of the defaults: it adds shortcuts and removes defaults.
- Built in:
  - _NanoForge_: the defaults, no change;
  - _VS Code_: `Ctrl+J` and `` Ctrl+` `` show the console, `Ctrl+Shift+M` shows the problems, `Ctrl+B` toggles the left top dock, `Ctrl+K Ctrl+S` opens the keyboard shortcuts;
  - _Godot_: `F8` stops the game, `F7` pauses and resumes it, `Ctrl+F1` shows the Scene screen, `Ctrl+F2` the Game screen and `Ctrl+F3` the Script screen.
- **Plugins add presets** in their manifest (`contributes.keymapPresets`) or through the `KEYMAP_PRESETS` extension point.
- The page has a preset selector (setting `keymap.preset`). Your own changes apply on top of whichever preset is chosen.

### Where changes are saved

- A selector picks **Account** (the default, when signed in) or **This machine**. It is locked while there are pending shortcut changes: apply them first.
- Each scope keeps its own list, and both apply in order (`keymap.overrides` merges across scopes, account first): this machine can add shortcuts, remove ones that come from the account, the preset or the defaults, and add back one the account removed.
- `keymap.overrides` and `keymap.preset` are edited by this page only: they leave the category tree.

## Core additions

- **Keybindings** (`ui`):
  - layers applied in order: defaults (`KEYBINDINGS`), the preset, the account's overrides, this machine's;
  - a `remove` entry cancels the shortcut whatever layer below added it, and a later entry can add it back;
  - `KeybindingService.suspend()` turns dispatch off while a shortcut is recorded;
  - overrides and preset entries can carry `args` (shortcuts for _View: Game_);
  - `resolveKeymap` and `findConflicts` as pure functions, so the page previews pending changes;
  - `KEYMAP_PRESETS` and `contributes.keymapPresets`; the `keymap.preset` setting.
- **Actions** (`ui`): `listActions` (commands and menu entries with arguments), shared by the palette and the keymap page.
- **Commands** (`kernel`): `CommandMetadata.palette` (`false` hides a command that needs arguments), also in manifests.
- **Settings pages** (`ui`, rendered by `settings-ui`): the `SETTINGS_PAGES` extension point. A page gets the dialog's pending changes (read a scope's own value, set it, a revision to follow) and names the settings it edits, which leave the category tree.
- **Code** (`code`): `CodeService.symbols(path)` (TypeScript's navigation tree).
- **Code editor**: the context key `codeEditor.activeFile`.
- **SDK**: exports for the above.

## Not built

- Palette providers from plugins (an extension point for more prefixes).
- Symbols across the whole project.

## Done when

- Unit tests: fuzzy matching and ranking, keymap layers (preset, overrides, removals, args), conflicts, the recorder's stroke handling, actions from commands and menus, symbols.
- Browser tests:
  - `Ctrl+Shift+P` finds and runs a command, and it comes first next time;
  - a command that depends on the focus (_Close panel_) acts on the panel that had it;
  - an action from a menu entry with arguments runs (_View: Problems_);
  - `Ctrl+P` opens a file by a fuzzy name;
  - `:line` and `@symbol` move the cursor in the open file, with the focus in the code editor;
  - the keymap page: add a chord to a command and use it, see and resolve a conflict, edit a condition, remove a default, reset;
  - a preset changes a shortcut, and a plugin's preset is listed;
  - a change saved to _This machine_ survives a reload.
