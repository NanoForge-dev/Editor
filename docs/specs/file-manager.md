# File manager plugin (`@nanoforge/file-manager`)

Requirements session: 2026-09-26/27. Built-in plugin in `plugins/file-manager`, the second of phase 9. It replaces the core's temporary Files panel.

## Goal

Browse and organize a game's files: a folder tree, plus a grid of the selected folder with thumbnails, like Unity's Project window or Godot's FileSystem dock. Every operation is undoable.

## Decisions

| Topic           | Decision                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Views           | **Tree + asset grid** in one dock, switchable: tree only, or tree and grid split. The grid shows the selected folder with thumbnails for images, and a play button for sounds. |
| Open            | Double click or `Enter` opens a file with its document editor (`documents.open`). _Open with…_ lists the other editors registered for the file.                                |
| Create          | New file and new folder, plus **templates** contributed by plugins (_New component_, _New system_, _New scene_ come with the ECS plugin).                                      |
| Organize        | Rename (inline), **move, copy, duplicate**, cut/copy/paste and drag and drop between folders. All undoable.                                                                    |
| Import          | Drop files from the computer onto a folder, or use _Import…_. Works on hosted editors too (upload).                                                                            |
| Reveal / export | _Reveal in file manager_ (local editors only); download a file, or a folder as `.zip`.                                                                                         |
| Delete          | Moves to `.nanoforge/editor/trash`, **undoable** (`Ctrl+Z` restores). No confirmation for one file; a confirmation for folders or several files.                               |
| Search          | A filter box: fuzzy match on names, with the matches shown in their folders.                                                                                                   |
| Packages        | When `nf_modules/` exists, a separate read-only **Packages** section with a lock. The server refuses writes under `nf_modules/`.                                               |

## Hidden files

- **`.nfignore`** at the project root (gitignore syntax) hides files from the **whole editor**: file manager, pickers, the code worker's TypeScript, and the watcher. It is optional and never created automatically. Builds and the game runtime still see everything.
- **The `@nanoforge/file-manager.exclude` setting** (gitignore patterns) hides files **in the file manager only**. Default:

  ```
  node_modules/
  dist/
  .turbo/
  coverage/
  .*
  !.env
  ```

- A _Show hidden files_ toggle shows what `@nanoforge/file-manager.exclude` hides. `.nfignore` entries stay hidden.

## Extension points (in the SDK, `@nanoforge-dev/editor-sdk/ui`)

- `FILE_TEMPLATES`: `{ id, title, icon?, category?, when?, defaultName, create(folder, name) → files }`, shown under _New_.
- `FILE_ACTIONS`: context menu entries for files and folders, `{ command, title, icon?, group?, when? }`. The `when` clauses see `fileKind`, `fileExtname`, `fileReadOnly` and `fileSelectionCount`.
- `FILE_ICONS`: `{ pattern, icon }`, most specific pattern first.

## Settings

| Key                                  | Default        | Meaning                          |
| ------------------------------------ | -------------- | -------------------------------- |
| `@nanoforge/file-manager.exclude`    | patterns above | Hidden in the file manager.      |
| `@nanoforge/file-manager.showHidden` | `false`        | Show what `exclude` hides.       |
| `@nanoforge/file-manager.view`       | `split`        | `tree` or `split` (tree + grid). |
| `@nanoforge/file-manager.gridSize`   | `96`           | Thumbnail size (px).             |

## Core and server additions

- `fs.delete` returns the trash location, and `fs.restore` brings it back (undo).
- `fs.reveal` (local only) opens the OS file manager.
- `GET /files/<project>/<path>` serves a project file (thumbnails, downloads); on a folder with `?download` it serves a `.zip`.
- `.nfignore` is read by the server: listings and watch events skip it.
- `nf_modules/**` is read-only for every write.

## Done when

- Browser tests:
  - tree and grid show `pong-network`, with an image thumbnail;
  - create from a template;
  - rename, move by drag and drop, copy/paste, duplicate, then undo each one;
  - delete, then `Ctrl+Z` restores the file;
  - import a file by drop;
  - search filters the tree;
  - `.nfignore` and `@nanoforge/file-manager.exclude` hide files, and the toggle shows the excluded ones;
  - `nf_modules` shows read-only, and writing there fails.
- Download a folder as `.zip`.
