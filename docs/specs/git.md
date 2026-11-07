# Git plugin (`@nanoforge/git`)

Requirements session: 2026-10-01. Built-in plugin in `plugins/git`, the fourth of phase 11. Local editors only: hosted (ONLINE) projects keep the server's commit-and-push, and gateway sync is designed with the backend contract in phase 12. In a hosted editor the panel says git is for local editors.

It uses the `git` installed on the machine, with the credentials git already has (no password prompt in the editor: a push that needs one fails with git's message).

The interface follows IntelliJ's (asked on 2026-10-01, after a first panel with staging lists): a **VCS** menu, a **Commit** panel on the left, a **Git** panel at the bottom.

## VCS menu

In the menu bar, after _Run_:

- _Initialize repository_ (only in a project that is not a repository: no `.git` in the project folder; a repository above it is never used);
- _Commit…_ (opens the Commit panel with the focus in the message), _Update project_ (a merge pull), _Push…_ (the Push dialog), _Fetch_;
- _New branch…_ (from the current commit, and switches to it), _Stash changes…_;
- _Show Git log_, _Refresh the repository state_.

The same commands are in the command palette. _Commit…_ and _Push…_ have no default shortcut: IntelliJ's `Ctrl+K` would hide the editor's chords that start with it, and `Ctrl+Shift+K` deletes a line in the code editor. Bind them in Keyboard shortcuts.

The **status bar** shows the branch and what is ahead and behind (`main ↑1 ↓2`); clicking it opens the Git panel.

## Commit panel

A dock widget on the left, after IntelliJ's Commit tool window (its documentation was the reference), with two tabs: **Commit** and **Stash**.

### Commit tab

- **Toolbar**: Refresh, Rollback, Show Diff, Stash Changes; on the right, Expand All and Collapse All.
- **The changes tree**: group nodes and, under each, a **flat list of files** (never folders or a tree: every file is a row, new files inside a new folder included).
  - Groups: **Merge Conflicts** (only while there are some), **Changes** (files git knows that changed), **Unversioned Files** (files git does not know).
  - A group node: a chevron (folds the group; remembered), a checkbox, the title, and the count (`3 files`). A group draws 500 rows at most and says how many more there are.
  - A file row: a checkbox, an icon, the file name colored by its status (modified blue, added green, deleted grey, unversioned red-brown, conflict red), then its folder to the right, dimmed.
- **Checkboxes are for the commit only.** New changes are checked; unversioned files are not. A group's checkbox checks or unchecks all of its files and shows a dash when only some are checked.
- **Selection is apart from the checkboxes.** Click selects a row (highlighted); `Ctrl`+click adds or removes one; `Shift`+click selects a range; **a click on a group node selects every file of the group**; a click beside the rows clears the selection.
- **Keyboard**, with the focus in the tree: arrows move the selection (`Shift` extends it), `Ctrl+A` selects all, `Space` checks or unchecks the selected files, `Enter` or `Ctrl+D` shows the diff, `F4` jumps to the source, `Ctrl+Alt+Z` rolls back, `Delete` deletes unversioned files.
- **Double-click** a file: its diff against the last commit, in the code editor. A deleted file has no diff; an unversioned one just opens.
- **Right-click**: _Show Diff_, _Jump to Source_, _Rollback…_, and for unversioned files _Add to VCS_ (git tracks it: it moves to Changes), _Delete…_ and _Add to .gitignore_; _Refresh_.
- **Rollback** (asks first, it can't be undone) acts on the **selected** rows, never on the checked ones: changed and deleted files go back to the last commit, a file added since leaves git but stays on disk, an unversioned file is deleted.
- **Merge conflicts**: the file opens in the code editor, where it is fixed by hand; _Mark resolved_ tells git it is done.
- **At the bottom**: **Amend** (the commit replaces the last one, and the message box starts from its message), the **commit message history** (the last ten messages), the message box, **Commit** and **Commit and Push…** (commits, then opens the Push dialog). Only the checked files are committed. `Ctrl+Enter` in the message commits. A merge is committed whole.

There is no staging area in the interface: what is checked is what is committed.

### Stash tab

**Stash Changes** (asks for an optional message; unversioned files are included), and the stashes with **Apply**, **Pop** and **Drop** (asks first).

## Push dialog

_Push…_ and _Commit and Push…_ open it: the branch and where it goes (`main → origin/main`), and the commits the push would send. **Push** sends them (and sets the upstream on a branch's first push); **Cancel** does nothing.

## Git panel

A dock widget at the bottom, after the Log tab of IntelliJ's Git tool window, in three panes:

- **Branches**: a toolbar (New Branch, Update Selected, Delete Branch, Fetch All Remotes, Push), a search box, then **HEAD (Current Branch)**, **Local** and **Remote** (branches under their remote: `origin` › `main`), each foldable.
  - Click a branch: the commits pane lists its history. Double-click: check it out (a remote's branch becomes a local one tracking it).
  - Right-click: _Checkout_, _New Branch from 'x'…_, _Update_, _Push…_, _Delete_ (asks first; a branch that is not merged asks a second time).
- **Commits**: a filter bar (_Text or hash_, the branch shown with its ahead/behind counts, _User_, _Date_), then one row per commit: a graph mark, the subject with the labels pointing at it (the current branch in yellow, local branches in green, remote ones in violet, tags in grey), the author, the date (`Today 14:32`). 50 commits, then _Show more_.
  - Right-click: _Copy Revision Number_, _New Branch…_ (from that commit).
- **Changed files** of the selected commit (a flat list, as in the Commit panel), and under it the **commit details**: message, hash, author, date, labels. Double-click a file: the current file compared with its version **before that commit**.

The panels refresh when project files change, when the window gets the focus back, and after each operation.

### Not like IntelliJ

- The graph is a straight line: the log lists one branch at a time, without merge lines.
- No changelists, shelves, commit checks, signing, cherry-pick, revert, reset, rebase, tags or interactive rebase.
- The User and Date filters apply to the commits already loaded.

## Files panel

Files are marked with their git status in the tree and the grid: a letter after the name and a color (modified, added or untracked, deleted, conflict). A folder is marked when something inside it changed.

## Core additions

- **Server** (`server-core`): `GitService` gains the operations above (commit of chosen files, amend, rollback, remote branches, a branch's history). Commands that talk to a remote stop after 60 s and never wait on a terminal for a passphrase. Every command runs with the project folder as the only place to look for a repository. A `GitContract` (`protocol`) exposes them, refused in hosted editors.
- **Code editor**: the command `codeEditor.compare` (a file against a given text, with a label), shown side by side like the disk-conflict comparison.
- **Files** (`ui`, rendered by the file manager): the `FILE_DECORATIONS` extension point (a badge, a tone and a tooltip per path).
- **SDK**: exports for the above.

## Not built

- Hosted (ONLINE) projects and gateway sync.
- A diff of two commits without the working file, a diff for deleted files, staging part of a file, rebase, tags, remotes management, a merge tool.
- Credentials: the editor never asks for a password or a token.

## Done when

- Server tests on real temporary repositories: status (every kind of change), stage, unstage, discard, commit, branches, log, stash, a conflict from a pull, push and pull with a local bare remote, and a repository above the project is ignored.
- Browser tests (the e2e project gets its own repository and a local bare remote), through the VCS menu and both panels:
  - initialize a repository; check unversioned files and commit them;
  - the commit, its details and its files in the Git panel;
  - a change is listed, checked, and marked in the Files tree; its diff opens on a double-click; unchecked it stays out of the commit; roll back;
  - new branch, checkout by double-click, delete from the context menu; the status bar follows;
  - push, fetch and the history of a remote's branch; ahead and behind counts;
  - an update that conflicts lists the file; mark resolved, commit and push;
  - amend;
  - stash from the menu, pop from the Stash tab.
