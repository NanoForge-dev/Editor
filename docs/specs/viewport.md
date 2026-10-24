# Viewport plugin (`@nanoforge/viewport`)

Requirements session: 2026-09-27. Built-in plugin in `plugins/viewport`, the third of phase 9. It replaces the core's temporary Game screen.

## Screens

- **Game** and **Scene** are separate main screens, like Godot's.
- **Scene** hosts the scene editor contributed for the project (the ECS plugin provides one). Without a scene editor it shows an empty state explaining which plugin fills it. The 2D/3D tools come with the ECS plugin's requirements session.

## Game screen

A toolbar above the running game:

| Tool              | Behavior                                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resolution**    | _Fit_ (the whole screen), or a preset: 1920×1080, 1280×720, 1024×768 (4:3), phone 390×844, tablet 820×1180, with a portrait/landscape switch, or a custom size. The game gets a container of that size; the engine's viewport fits the design resolution inside it. |
| **Zoom**          | 25–400% of the preset size (not in _Fit_); _Pixel perfect_ limits zoom to integer steps and renders pixelated.                                                                                                                                                      |
| **Stats**         | A toggleable overlay: ticks per second, tick time (average and max), the slowest libraries, JS heap (client), from the engine's frame stats.                                                                                                                        |
| **Mute**          | Mutes the game's sounds and music (engine `mute` command).                                                                                                                                                                                                          |
| **Screenshot**    | Saves the game's canvas as a PNG under `screenshots/` in the project, and copies it to the clipboard.                                                                                                                                                               |
| **Pop out**       | Moves the running game to a separate browser window. It keeps running; closing the window brings it back. Keyboard input typed in the window reaches the game.                                                                                                      |
| Contributed tools | `VIEWPORT_TOOLS` from other plugins (SDK).                                                                                                                                                                                                                          |

"Same tools as other editors" was read as the usual Unity/Godot Game-view extras: stats, mute, screenshot, maximize on play, plus the extension point for more.

## Play behavior

- Play switches to the Game screen (unless only the server plays). **Stop returns to the previous screen.**
- **The game gets keyboard focus on Play.** `Escape` gives focus back to the editor.
- **Maximize on play** (setting, off by default): the docks are hidden while playing.
- **Paused**: the game is dimmed, with a _Paused_ badge.

## Extension points (SDK, `@nanoforge-dev/editor-sdk/ui`)

- `SCENE_EDITORS`: `{ id, title, targets, component | mount }`, the Scene screen's content for codegen targets (`targets`: ids of `codegen.target` providers, `*` for any).
- `VIEWPORT_TOOLS`: `{ id, screen, icon, title, command, order?, when?, toggled? }`, buttons in the Game or Scene toolbar.
- `VIEWPORT_OVERLAYS`: `{ id, screen, component }`, drawn over the game or the scene.

## Settings

| Key                                  | Default     | Meaning                            |
| ------------------------------------ | ----------- | ---------------------------------- |
| `@nanoforge/viewport.resolution`     | `fit`       | `fit`, a preset id, or `WxH`.      |
| `@nanoforge/viewport.orientation`    | `landscape` | For device presets.                |
| `@nanoforge/viewport.zoom`           | `1`         | Zoom of fixed resolutions.         |
| `@nanoforge/viewport.pixelPerfect`   | `false`     | Integer zoom, pixelated rendering. |
| `@nanoforge/viewport.stats`          | `false`     | Stats overlay.                     |
| `@nanoforge/viewport.muted`          | `false`     | Game sound muted.                  |
| `@nanoforge/viewport.maximizeOnPlay` | `false`     | Hide the docks while playing.      |

## Core and engine additions

- Engine: a `mute` bridge command (`[muted: boolean]`), handled by the sound and music libraries.
- Layout: a temporary _hide docks_ state (not saved, not an undo step), used by _Maximize on play_.
- Runtime: Play no longer opens a screen itself; the viewport does, so another viewport plugin can replace it.

## Done when

- Browser tests:
  - Play shows the Game screen, focuses the game, and Stop goes back to the previous screen;
  - a resolution preset sizes the game;
  - the stats overlay shows ticks per second;
  - a screenshot is saved in `screenshots/`;
  - _Maximize on play_ hides the docks;
  - paused is dimmed;
  - pop out moves the game to a new window and back;
  - the Scene screen shows the scene editor of the project (the ECS 2D scene for pong); without one it shows an empty state (not tested: every e2e project has the ECS).
