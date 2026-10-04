import type { Context } from "@nanoforge-dev/common";
import type { Registry } from "@nanoforge-dev/ecs/client";
import { EcsScene } from "@nanoforge-dev/ecs/scene";
import { Rect } from "@nanoforge-dev/graphics-2d";
import { InputEnum } from "@nanoforge-dev/input";
import type { SceneClass } from "@nanoforge-dev/scene";

import { Box } from "../components/box";
import { Brick } from "../components/brick";
import { Position } from "../components/position";
import { Visual } from "../components/visual";
import { justPressed } from "../keys";
import { GameOver } from "./game-over";
import { Pause } from "./pause";
import { Run } from "./run";
import { Victory } from "./victory";

/**
 * What every level has: its parent, `Run`, and the level after it. Levels are siblings under
 * `Run`: moving to the next one unloads this one (its bricks and its vars) and keeps the paddle,
 * the ball, the score and the lives. Each level writes its own bricks in its `setup`.
 */
export abstract class Level extends EcsScene {
  static override parent = Run;

  /** The level after this one; the last one has none. */
  abstract readonly next: SceneClass | undefined;
}

/**
 * Moves on when the level ends: to the next level once every brick is broken, or to the end
 * screen when the last life is lost.
 *
 * @system
 * @side client
 */
export function levelFlow(_registry: Registry, ctx: Context) {
  const vars = ctx.scenes.vars;
  if (vars.has("paused")) return;
  const score = vars.get("score") ?? 0;

  if ((vars.get("lives") ?? 0) <= 0) {
    void ctx.scenes.load(ctx, GameOver, { params: { score } });
    return;
  }
  if ((vars.get("bricksLeft") ?? 1) > 0) return;
  const level = ctx.scenes.loaded.find((scene) => scene instanceof Level);
  if (level?.next) void ctx.scenes.load(ctx, level.next);
  else void ctx.scenes.load(ctx, Victory, { params: { score } });
}

/**
 * Opens the pause menu over the level with Escape or P.
 *
 * @system
 * @side client
 */
export function pauseOnEscape(_registry: Registry, ctx: Context) {
  if (ctx.scenes.vars.has("paused")) return;
  const escape = justPressed(ctx, InputEnum.Escape);
  const p = justPressed(ctx, InputEnum.KeyP);
  if (escape || p) void ctx.scenes.load(ctx, Pause, { parent: "current" });
}

/**
 * Level 1: three rows that break in one hit.
 *
 * @scene
 * @side client
 * @vars level, bricksLeft, ballSpeed, served
 */
export class Level1 extends Level {
  readonly next = Level2;

  override setup(registry: Registry, ctx: Context) {
    // Owned by the level: gone when the next one is loaded, which makes its own.
    ctx.scenes.vars.init("level", 1);
    ctx.scenes.vars.init("bricksLeft", 24);
    ctx.scenes.vars.init("ballSpeed", 0.45);
    ctx.scenes.vars.init("served", false);

    const brick1 = registry.spawnEntity();
    registry.addComponent(brick1, new Position(48, 130));
    registry.addComponent(brick1, new Box(141, 26));
    registry.addComponent(brick1, new Brick(1, 10));
    registry.addComponent(
      brick1,
      new Visual(new Rect({ width: 141, height: 26, fill: "#eb4d4b", cornerRadius: 4 })),
    );
    const brick2 = registry.spawnEntity();
    registry.addComponent(brick2, new Position(197, 130));
    registry.addComponent(brick2, new Box(141, 26));
    registry.addComponent(brick2, new Brick(1, 10));
    registry.addComponent(
      brick2,
      new Visual(new Rect({ width: 141, height: 26, fill: "#eb4d4b", cornerRadius: 4 })),
    );
    const brick3 = registry.spawnEntity();
    registry.addComponent(brick3, new Position(346, 130));
    registry.addComponent(brick3, new Box(141, 26));
    registry.addComponent(brick3, new Brick(1, 10));
    registry.addComponent(
      brick3,
      new Visual(new Rect({ width: 141, height: 26, fill: "#eb4d4b", cornerRadius: 4 })),
    );
    const brick4 = registry.spawnEntity();
    registry.addComponent(brick4, new Position(495, 130));
    registry.addComponent(brick4, new Box(141, 26));
    registry.addComponent(brick4, new Brick(1, 10));
    registry.addComponent(
      brick4,
      new Visual(new Rect({ width: 141, height: 26, fill: "#eb4d4b", cornerRadius: 4 })),
    );
    const brick5 = registry.spawnEntity();
    registry.addComponent(brick5, new Position(644, 130));
    registry.addComponent(brick5, new Box(141, 26));
    registry.addComponent(brick5, new Brick(1, 10));
    registry.addComponent(
      brick5,
      new Visual(new Rect({ width: 141, height: 26, fill: "#eb4d4b", cornerRadius: 4 })),
    );
    const brick6 = registry.spawnEntity();
    registry.addComponent(brick6, new Position(793, 130));
    registry.addComponent(brick6, new Box(141, 26));
    registry.addComponent(brick6, new Brick(1, 10));
    registry.addComponent(
      brick6,
      new Visual(new Rect({ width: 141, height: 26, fill: "#eb4d4b", cornerRadius: 4 })),
    );
    const brick7 = registry.spawnEntity();
    registry.addComponent(brick7, new Position(942, 130));
    registry.addComponent(brick7, new Box(141, 26));
    registry.addComponent(brick7, new Brick(1, 10));
    registry.addComponent(
      brick7,
      new Visual(new Rect({ width: 141, height: 26, fill: "#eb4d4b", cornerRadius: 4 })),
    );
    const brick8 = registry.spawnEntity();
    registry.addComponent(brick8, new Position(1091, 130));
    registry.addComponent(brick8, new Box(141, 26));
    registry.addComponent(brick8, new Brick(1, 10));
    registry.addComponent(
      brick8,
      new Visual(new Rect({ width: 141, height: 26, fill: "#eb4d4b", cornerRadius: 4 })),
    );
    const brick9 = registry.spawnEntity();
    registry.addComponent(brick9, new Position(48, 164));
    registry.addComponent(brick9, new Box(141, 26));
    registry.addComponent(brick9, new Brick(1, 10));
    registry.addComponent(
      brick9,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick10 = registry.spawnEntity();
    registry.addComponent(brick10, new Position(197, 164));
    registry.addComponent(brick10, new Box(141, 26));
    registry.addComponent(brick10, new Brick(1, 10));
    registry.addComponent(
      brick10,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick11 = registry.spawnEntity();
    registry.addComponent(brick11, new Position(346, 164));
    registry.addComponent(brick11, new Box(141, 26));
    registry.addComponent(brick11, new Brick(1, 10));
    registry.addComponent(
      brick11,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick12 = registry.spawnEntity();
    registry.addComponent(brick12, new Position(495, 164));
    registry.addComponent(brick12, new Box(141, 26));
    registry.addComponent(brick12, new Brick(1, 10));
    registry.addComponent(
      brick12,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick13 = registry.spawnEntity();
    registry.addComponent(brick13, new Position(644, 164));
    registry.addComponent(brick13, new Box(141, 26));
    registry.addComponent(brick13, new Brick(1, 10));
    registry.addComponent(
      brick13,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick14 = registry.spawnEntity();
    registry.addComponent(brick14, new Position(793, 164));
    registry.addComponent(brick14, new Box(141, 26));
    registry.addComponent(brick14, new Brick(1, 10));
    registry.addComponent(
      brick14,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick15 = registry.spawnEntity();
    registry.addComponent(brick15, new Position(942, 164));
    registry.addComponent(brick15, new Box(141, 26));
    registry.addComponent(brick15, new Brick(1, 10));
    registry.addComponent(
      brick15,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick16 = registry.spawnEntity();
    registry.addComponent(brick16, new Position(1091, 164));
    registry.addComponent(brick16, new Box(141, 26));
    registry.addComponent(brick16, new Brick(1, 10));
    registry.addComponent(
      brick16,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick17 = registry.spawnEntity();
    registry.addComponent(brick17, new Position(48, 198));
    registry.addComponent(brick17, new Box(141, 26));
    registry.addComponent(brick17, new Brick(1, 10));
    registry.addComponent(
      brick17,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick18 = registry.spawnEntity();
    registry.addComponent(brick18, new Position(197, 198));
    registry.addComponent(brick18, new Box(141, 26));
    registry.addComponent(brick18, new Brick(1, 10));
    registry.addComponent(
      brick18,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick19 = registry.spawnEntity();
    registry.addComponent(brick19, new Position(346, 198));
    registry.addComponent(brick19, new Box(141, 26));
    registry.addComponent(brick19, new Brick(1, 10));
    registry.addComponent(
      brick19,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick20 = registry.spawnEntity();
    registry.addComponent(brick20, new Position(495, 198));
    registry.addComponent(brick20, new Box(141, 26));
    registry.addComponent(brick20, new Brick(1, 10));
    registry.addComponent(
      brick20,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick21 = registry.spawnEntity();
    registry.addComponent(brick21, new Position(644, 198));
    registry.addComponent(brick21, new Box(141, 26));
    registry.addComponent(brick21, new Brick(1, 10));
    registry.addComponent(
      brick21,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick22 = registry.spawnEntity();
    registry.addComponent(brick22, new Position(793, 198));
    registry.addComponent(brick22, new Box(141, 26));
    registry.addComponent(brick22, new Brick(1, 10));
    registry.addComponent(
      brick22,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick23 = registry.spawnEntity();
    registry.addComponent(brick23, new Position(942, 198));
    registry.addComponent(brick23, new Box(141, 26));
    registry.addComponent(brick23, new Brick(1, 10));
    registry.addComponent(
      brick23,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick24 = registry.spawnEntity();
    registry.addComponent(brick24, new Position(1091, 198));
    registry.addComponent(brick24, new Box(141, 26));
    registry.addComponent(brick24, new Brick(1, 10));
    registry.addComponent(
      brick24,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );

    registry.addSystem(levelFlow);
    registry.addSystem(pauseOnEscape);
  }
}

/**
 * Level 2: a pyramid, faster.
 *
 * @scene
 * @side client
 * @vars level, bricksLeft, ballSpeed, served
 */
export class Level2 extends Level {
  readonly next = Level3;

  override setup(registry: Registry, ctx: Context) {
    // Owned by the level: gone when the next one is loaded, which makes its own.
    ctx.scenes.vars.init("level", 2);
    ctx.scenes.vars.init("bricksLeft", 20);
    ctx.scenes.vars.init("ballSpeed", 0.55);
    ctx.scenes.vars.init("served", false);

    const brick1 = registry.spawnEntity();
    registry.addComponent(brick1, new Position(495, 130));
    registry.addComponent(brick1, new Box(141, 26));
    registry.addComponent(brick1, new Brick(1, 10));
    registry.addComponent(
      brick1,
      new Visual(new Rect({ width: 141, height: 26, fill: "#eb4d4b", cornerRadius: 4 })),
    );
    const brick2 = registry.spawnEntity();
    registry.addComponent(brick2, new Position(644, 130));
    registry.addComponent(brick2, new Box(141, 26));
    registry.addComponent(brick2, new Brick(1, 10));
    registry.addComponent(
      brick2,
      new Visual(new Rect({ width: 141, height: 26, fill: "#eb4d4b", cornerRadius: 4 })),
    );
    const brick3 = registry.spawnEntity();
    registry.addComponent(brick3, new Position(346, 164));
    registry.addComponent(brick3, new Box(141, 26));
    registry.addComponent(brick3, new Brick(1, 10));
    registry.addComponent(
      brick3,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick4 = registry.spawnEntity();
    registry.addComponent(brick4, new Position(495, 164));
    registry.addComponent(brick4, new Box(141, 26));
    registry.addComponent(brick4, new Brick(1, 10));
    registry.addComponent(
      brick4,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick5 = registry.spawnEntity();
    registry.addComponent(brick5, new Position(644, 164));
    registry.addComponent(brick5, new Box(141, 26));
    registry.addComponent(brick5, new Brick(1, 10));
    registry.addComponent(
      brick5,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick6 = registry.spawnEntity();
    registry.addComponent(brick6, new Position(793, 164));
    registry.addComponent(brick6, new Box(141, 26));
    registry.addComponent(brick6, new Brick(1, 10));
    registry.addComponent(
      brick6,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick7 = registry.spawnEntity();
    registry.addComponent(brick7, new Position(197, 198));
    registry.addComponent(brick7, new Box(141, 26));
    registry.addComponent(brick7, new Brick(1, 10));
    registry.addComponent(
      brick7,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick8 = registry.spawnEntity();
    registry.addComponent(brick8, new Position(346, 198));
    registry.addComponent(brick8, new Box(141, 26));
    registry.addComponent(brick8, new Brick(1, 10));
    registry.addComponent(
      brick8,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick9 = registry.spawnEntity();
    registry.addComponent(brick9, new Position(495, 198));
    registry.addComponent(brick9, new Box(141, 26));
    registry.addComponent(brick9, new Brick(1, 10));
    registry.addComponent(
      brick9,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick10 = registry.spawnEntity();
    registry.addComponent(brick10, new Position(644, 198));
    registry.addComponent(brick10, new Box(141, 26));
    registry.addComponent(brick10, new Brick(1, 10));
    registry.addComponent(
      brick10,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick11 = registry.spawnEntity();
    registry.addComponent(brick11, new Position(793, 198));
    registry.addComponent(brick11, new Box(141, 26));
    registry.addComponent(brick11, new Brick(1, 10));
    registry.addComponent(
      brick11,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick12 = registry.spawnEntity();
    registry.addComponent(brick12, new Position(942, 198));
    registry.addComponent(brick12, new Box(141, 26));
    registry.addComponent(brick12, new Brick(1, 10));
    registry.addComponent(
      brick12,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick13 = registry.spawnEntity();
    registry.addComponent(brick13, new Position(48, 232));
    registry.addComponent(brick13, new Box(141, 26));
    registry.addComponent(brick13, new Brick(1, 10));
    registry.addComponent(
      brick13,
      new Visual(new Rect({ width: 141, height: 26, fill: "#6ab04c", cornerRadius: 4 })),
    );
    const brick14 = registry.spawnEntity();
    registry.addComponent(brick14, new Position(197, 232));
    registry.addComponent(brick14, new Box(141, 26));
    registry.addComponent(brick14, new Brick(1, 10));
    registry.addComponent(
      brick14,
      new Visual(new Rect({ width: 141, height: 26, fill: "#6ab04c", cornerRadius: 4 })),
    );
    const brick15 = registry.spawnEntity();
    registry.addComponent(brick15, new Position(346, 232));
    registry.addComponent(brick15, new Box(141, 26));
    registry.addComponent(brick15, new Brick(1, 10));
    registry.addComponent(
      brick15,
      new Visual(new Rect({ width: 141, height: 26, fill: "#6ab04c", cornerRadius: 4 })),
    );
    const brick16 = registry.spawnEntity();
    registry.addComponent(brick16, new Position(495, 232));
    registry.addComponent(brick16, new Box(141, 26));
    registry.addComponent(brick16, new Brick(1, 10));
    registry.addComponent(
      brick16,
      new Visual(new Rect({ width: 141, height: 26, fill: "#6ab04c", cornerRadius: 4 })),
    );
    const brick17 = registry.spawnEntity();
    registry.addComponent(brick17, new Position(644, 232));
    registry.addComponent(brick17, new Box(141, 26));
    registry.addComponent(brick17, new Brick(1, 10));
    registry.addComponent(
      brick17,
      new Visual(new Rect({ width: 141, height: 26, fill: "#6ab04c", cornerRadius: 4 })),
    );
    const brick18 = registry.spawnEntity();
    registry.addComponent(brick18, new Position(793, 232));
    registry.addComponent(brick18, new Box(141, 26));
    registry.addComponent(brick18, new Brick(1, 10));
    registry.addComponent(
      brick18,
      new Visual(new Rect({ width: 141, height: 26, fill: "#6ab04c", cornerRadius: 4 })),
    );
    const brick19 = registry.spawnEntity();
    registry.addComponent(brick19, new Position(942, 232));
    registry.addComponent(brick19, new Box(141, 26));
    registry.addComponent(brick19, new Brick(1, 10));
    registry.addComponent(
      brick19,
      new Visual(new Rect({ width: 141, height: 26, fill: "#6ab04c", cornerRadius: 4 })),
    );
    const brick20 = registry.spawnEntity();
    registry.addComponent(brick20, new Position(1091, 232));
    registry.addComponent(brick20, new Box(141, 26));
    registry.addComponent(brick20, new Brick(1, 10));
    registry.addComponent(
      brick20,
      new Visual(new Rect({ width: 141, height: 26, fill: "#6ab04c", cornerRadius: 4 })),
    );

    registry.addSystem(levelFlow);
    registry.addSystem(pauseOnEscape);
  }
}

/**
 * Level 3: bricks that take two hits, faster still. The last level.
 *
 * @scene
 * @side client
 * @vars level, bricksLeft, ballSpeed, served
 */
export class Level3 extends Level {
  readonly next = undefined;

  override setup(registry: Registry, ctx: Context) {
    // Owned by the level: gone when the next one is loaded, which makes its own.
    ctx.scenes.vars.init("level", 3);
    ctx.scenes.vars.init("bricksLeft", 24);
    ctx.scenes.vars.init("ballSpeed", 0.65);
    ctx.scenes.vars.init("served", false);

    const brick1 = registry.spawnEntity();
    registry.addComponent(brick1, new Position(48, 130));
    registry.addComponent(brick1, new Box(141, 26));
    registry.addComponent(brick1, new Brick(2, 20));
    registry.addComponent(
      brick1,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#eb4d4b",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick2 = registry.spawnEntity();
    registry.addComponent(brick2, new Position(197, 130));
    registry.addComponent(brick2, new Box(141, 26));
    registry.addComponent(brick2, new Brick(2, 20));
    registry.addComponent(
      brick2,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#eb4d4b",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick3 = registry.spawnEntity();
    registry.addComponent(brick3, new Position(346, 130));
    registry.addComponent(brick3, new Box(141, 26));
    registry.addComponent(brick3, new Brick(2, 20));
    registry.addComponent(
      brick3,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#eb4d4b",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick4 = registry.spawnEntity();
    registry.addComponent(brick4, new Position(495, 130));
    registry.addComponent(brick4, new Box(141, 26));
    registry.addComponent(brick4, new Brick(2, 20));
    registry.addComponent(
      brick4,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#eb4d4b",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick5 = registry.spawnEntity();
    registry.addComponent(brick5, new Position(644, 130));
    registry.addComponent(brick5, new Box(141, 26));
    registry.addComponent(brick5, new Brick(2, 20));
    registry.addComponent(
      brick5,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#eb4d4b",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick6 = registry.spawnEntity();
    registry.addComponent(brick6, new Position(793, 130));
    registry.addComponent(brick6, new Box(141, 26));
    registry.addComponent(brick6, new Brick(2, 20));
    registry.addComponent(
      brick6,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#eb4d4b",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick7 = registry.spawnEntity();
    registry.addComponent(brick7, new Position(942, 130));
    registry.addComponent(brick7, new Box(141, 26));
    registry.addComponent(brick7, new Brick(2, 20));
    registry.addComponent(
      brick7,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#eb4d4b",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick8 = registry.spawnEntity();
    registry.addComponent(brick8, new Position(1091, 130));
    registry.addComponent(brick8, new Box(141, 26));
    registry.addComponent(brick8, new Brick(2, 20));
    registry.addComponent(
      brick8,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#eb4d4b",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick9 = registry.spawnEntity();
    registry.addComponent(brick9, new Position(48, 164));
    registry.addComponent(brick9, new Box(141, 26));
    registry.addComponent(brick9, new Brick(1, 10));
    registry.addComponent(
      brick9,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick10 = registry.spawnEntity();
    registry.addComponent(brick10, new Position(346, 164));
    registry.addComponent(brick10, new Box(141, 26));
    registry.addComponent(brick10, new Brick(1, 10));
    registry.addComponent(
      brick10,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick11 = registry.spawnEntity();
    registry.addComponent(brick11, new Position(793, 164));
    registry.addComponent(brick11, new Box(141, 26));
    registry.addComponent(brick11, new Brick(1, 10));
    registry.addComponent(
      brick11,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick12 = registry.spawnEntity();
    registry.addComponent(brick12, new Position(1091, 164));
    registry.addComponent(brick12, new Box(141, 26));
    registry.addComponent(brick12, new Brick(1, 10));
    registry.addComponent(
      brick12,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f0932b", cornerRadius: 4 })),
    );
    const brick13 = registry.spawnEntity();
    registry.addComponent(brick13, new Position(48, 198));
    registry.addComponent(brick13, new Box(141, 26));
    registry.addComponent(brick13, new Brick(2, 20));
    registry.addComponent(
      brick13,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#f9ca24",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick14 = registry.spawnEntity();
    registry.addComponent(brick14, new Position(197, 198));
    registry.addComponent(brick14, new Box(141, 26));
    registry.addComponent(brick14, new Brick(1, 10));
    registry.addComponent(
      brick14,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick15 = registry.spawnEntity();
    registry.addComponent(brick15, new Position(346, 198));
    registry.addComponent(brick15, new Box(141, 26));
    registry.addComponent(brick15, new Brick(2, 20));
    registry.addComponent(
      brick15,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#f9ca24",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick16 = registry.spawnEntity();
    registry.addComponent(brick16, new Position(495, 198));
    registry.addComponent(brick16, new Box(141, 26));
    registry.addComponent(brick16, new Brick(1, 10));
    registry.addComponent(
      brick16,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick17 = registry.spawnEntity();
    registry.addComponent(brick17, new Position(644, 198));
    registry.addComponent(brick17, new Box(141, 26));
    registry.addComponent(brick17, new Brick(1, 10));
    registry.addComponent(
      brick17,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick18 = registry.spawnEntity();
    registry.addComponent(brick18, new Position(793, 198));
    registry.addComponent(brick18, new Box(141, 26));
    registry.addComponent(brick18, new Brick(2, 20));
    registry.addComponent(
      brick18,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#f9ca24",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick19 = registry.spawnEntity();
    registry.addComponent(brick19, new Position(942, 198));
    registry.addComponent(brick19, new Box(141, 26));
    registry.addComponent(brick19, new Brick(1, 10));
    registry.addComponent(
      brick19,
      new Visual(new Rect({ width: 141, height: 26, fill: "#f9ca24", cornerRadius: 4 })),
    );
    const brick20 = registry.spawnEntity();
    registry.addComponent(brick20, new Position(1091, 198));
    registry.addComponent(brick20, new Box(141, 26));
    registry.addComponent(brick20, new Brick(2, 20));
    registry.addComponent(
      brick20,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#f9ca24",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick21 = registry.spawnEntity();
    registry.addComponent(brick21, new Position(48, 232));
    registry.addComponent(brick21, new Box(141, 26));
    registry.addComponent(brick21, new Brick(2, 20));
    registry.addComponent(
      brick21,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#6ab04c",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick22 = registry.spawnEntity();
    registry.addComponent(brick22, new Position(346, 232));
    registry.addComponent(brick22, new Box(141, 26));
    registry.addComponent(brick22, new Brick(2, 20));
    registry.addComponent(
      brick22,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#6ab04c",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick23 = registry.spawnEntity();
    registry.addComponent(brick23, new Position(793, 232));
    registry.addComponent(brick23, new Box(141, 26));
    registry.addComponent(brick23, new Brick(2, 20));
    registry.addComponent(
      brick23,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#6ab04c",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );
    const brick24 = registry.spawnEntity();
    registry.addComponent(brick24, new Position(1091, 232));
    registry.addComponent(brick24, new Box(141, 26));
    registry.addComponent(brick24, new Brick(2, 20));
    registry.addComponent(
      brick24,
      new Visual(
        new Rect({
          width: 141,
          height: 26,
          fill: "#6ab04c",
          cornerRadius: 4,
          stroke: "#ffffff",
          strokeWidth: 3,
        }),
      ),
    );

    registry.addSystem(levelFlow);
    registry.addSystem(pauseOnEscape);
  }
}
