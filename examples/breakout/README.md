# Breakout

A breakout made of **scenes** (`@nanoforge-dev/scene`): a menu, a game with three levels, a pause menu and two end screens. Every entity and every system belongs to a scene, and goes away with it.

## Open it

The scene module is on the engine branch `feat/scene` (worktree `../engine-scene`). From the root of the editor repository:

```sh
pnpm install
pnpm turbo build --filter=@nanoforge-dev/editor...
NANOFORGE_ENGINE=../engine-scene pnpm example breakout
```

Then open <http://127.0.0.1:4800/load?path=breakout> and press **Play** (`F5`). The engine needs `pnpm install` and `pnpm build` once.

| Key        | Does                                |
| ---------- | ----------------------------------- |
| Enter      | Starts a game, leaves an end screen |
| ← →        | Moves the paddle                    |
| Space      | Serves the ball                     |
| Esc or P   | Pauses, resumes                     |
| Q (paused) | Quits to the menu                   |

## The scenes

```text
Menu                 root: the title, the best score
Run                  root: walls, paddle, ball, top bar; vars score, lives
├── Level1           bricks; vars level, bricksLeft, ballSpeed, served
├── Level2
├── Level3
└── (Pause)          no parent of its own: loaded over the current level
GameOver, Victory    roots: the score comes as a param
```

What each move does:

| From                   | To                           | Unloaded                 | Loaded          |
| ---------------------- | ---------------------------- | ------------------------ | --------------- |
| `Menu`                 | `Level1` (Enter)             | `Menu`                   | `Run`, `Level1` |
| `Run › Level1`         | `Level2` (bricks gone)       | `Level1`                 | `Level2`        |
| `Run › Level1`         | `Pause`, `parent: "current"` | nothing                  | `Pause`         |
| `Run › Level1 › Pause` | unload `Pause` (Esc)         | `Pause`                  | nothing         |
| `Run › Level1 › Pause` | `Menu` (Q)                   | `Pause`, `Level1`, `Run` | `Menu`          |
| `Run › Level3`         | `Victory`, `{ score }`       | `Level3`, `Run`          | `Victory`       |

The vars follow their scenes (`src/scene-vars.ts` types and documents them): `score` and `lives` go with `Run`, so a new game starts from 0 and 3 lives; a level's `bricksLeft` and `served` are made again by the next level; `paused` exists only while `Pause` is loaded, and the game's systems stop while it does; `best` is persistent.

## Layout

```text
apps/client/src/
├── main.ts                 the libraries; SceneLibrary starts on Menu and lists every scene by id
├── scenes/                 one EcsScene per file: menu, run, levels, pause, game-over, victory
├── systems/                the game's systems: paddle, ball, lives, HUD, drawing, back to menu
├── components/             Position, Velocity, Box, Visual, Paddle, Ball, Brick, HudText
├── scene-vars.ts           the scene vars' types and docs (SceneVars)
└── keys.ts                 justPressed: a key down since the last time a system asked
```

Every scene is an `EcsScene` (`@nanoforge-dev/ecs/scene`): its `setup(registry, ctx)` spawns its entities and adds its systems, written like a `main`, and they are removed when the scene unloads. The editor's Scenes panel edits them like `main.ts` (each level writes its bricks out for that). Scenes, components and systems are documented with TSDoc tags (`@scene`, `@component`, `@system`, `@side`, `@vars`).

Three things to know when writing scenes like these:

- **A scene's parent is read when its module is evaluated** (`static override parent = Run`). `run.ts` imports no other scene, so the levels always find `Run` defined.
- **The ECS finds a component by its class name.** A component named like a class the bundle already has (graphics-2d's `Sprite`, `Text`, `Rect`…) is renamed by the bundler (`Sprite2`), and no longer matches its `name` field: that is why the shape component is `Visual`. `SceneLibrary`'s `scenes` gives each scene an id for the same reason.
- **A component with a `destroy()` method** gets it called when its scene unloads: `Visual` removes its shape from the screen.
