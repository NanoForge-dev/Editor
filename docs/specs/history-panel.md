# History panel plugin (`@nanoforge/history-panel`)

Requirements session: 2026-09-27. Built-in plugin in `plugins/history-panel`, the fourth of phase 9. It replaces the core's temporary History panel.

## What it lists

- By default, **the history of what you are working on**: the context of the last focused widget (the layout, the files panel, a document…).
- An **All** switch shows every context, grouped and collapsible: Layout, Files, each document, plugin contexts.
- Typing in the code editor stays in Monaco's own undo (phase 4 decision). A document's context lists the changes made through the editor: codegen and plugin operations (the ECS plugin's edits, for example).

## Entries

- **Label**, **time** (relative, e.g. "2 min ago") and **origin**: _you_, a plugin (e.g. codegen), or later a collaborator. Changes of other origins cannot be undone and are shown muted.
- **Grouped steps**: a transaction (one drag, one codegen operation) is one entry that expands to its steps.
- **Diff preview**: entries that edit a document show the changed lines, before and after, on hover or focus.
- The current position is marked. Undone steps (redo) stay listed below it, dimmed.

## Actions

- **Jump to a step**: click an entry to undo or redo up to it.
- **Clear** a context's history (with a confirmation).
- **Search** entries by label.
- **Keep across reloads** for documents: their history (text edits) is stored in the browser per project, and restored when the document's context comes back. The layout and files histories stay session-only.

## Core additions

- `HistoryCommand.preview` (the before/after text of an edit) and `HistoryCommand.serialize()`, plus `HistoryService.registerDeserializer`, for restoring. Composite commands expose their `children`.
- `HistoryStack.goTo(entryId)` and `restore(entries)`; `HistoryService.goTo` and `clear`.
- `DocumentService.edit(uri, edits, { label, origin })`: one undoable step in the document's `file:<uri>` context. Its commands carry a preview and are serializable.
- Persistence of `file:*` contexts in IndexedDB, per project.

## Done when

- Browser tests:
  - the panel follows the focused context, and _All_ lists every context;
  - jumping to an older step undoes the steps after it, and clicking a newer step redoes them;
  - a grouped step expands;
  - the diff preview shows a document edit;
  - search filters entries;
  - clear empties a context;
  - a document's history survives a reload.
