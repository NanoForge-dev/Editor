import type { Context } from "@nanoforge-dev/common";
import type { Registry } from "@nanoforge-dev/ecs/client";
import { EcsScene } from "@nanoforge-dev/ecs/scene";
import { Rect, Text } from "@nanoforge-dev/graphics-2d";

import { Ball } from "../components/ball";
import { Box } from "../components/box";
import { HudText } from "../components/hud-text";
import { Paddle } from "../components/paddle";
import { Position } from "../components/position";
import { Velocity } from "../components/velocity";
import { Visual } from "../components/visual";
import { loseBall } from "../systems/lose-ball";
import { moveBall } from "../systems/move-ball";
import { movePaddle } from "../systems/move-paddle";
import { updateHud } from "../systems/update-hud";

/**
 * A game, from the first level to the last or to the last life: the walls, the paddle, the ball
 * and the top bar. The levels are loaded under it, so they keep the paddle, the ball, the score
 * and the lives.
 *
 * It must not import a level (or anything that does): the levels name it as their parent when
 * their module is evaluated.
 *
 * @scene
 * @side client
 * @vars score, lives
 */
export class Run extends EcsScene {
  override setup(registry: Registry, ctx: Context) {
    ctx.scenes.vars.init("score", 0);
    ctx.scenes.vars.init("lives", 3);

    const topBar = registry.spawnEntity();
    registry.addComponent(topBar, new Position(0, 0));
    registry.addComponent(
      topBar,
      new Visual(new Rect({ width: 1280, height: 80, fill: "#1b2133" })),
    );
    const leftWall = registry.spawnEntity();
    registry.addComponent(leftWall, new Position(0, 80));
    registry.addComponent(
      leftWall,
      new Visual(new Rect({ width: 40, height: 640, fill: "#2a3350" })),
    );
    const rightWall = registry.spawnEntity();
    registry.addComponent(rightWall, new Position(1240, 80));
    registry.addComponent(
      rightWall,
      new Visual(new Rect({ width: 40, height: 640, fill: "#2a3350" })),
    );

    const score = registry.spawnEntity();
    registry.addComponent(score, new Position(60, 28));
    registry.addComponent(score, new HudText("score"));
    registry.addComponent(
      score,
      new Visual(new Text({ fontSize: 30, fill: "#e8ecf8", fontFamily: "monospace" })),
    );
    const level = registry.spawnEntity();
    registry.addComponent(level, new Position(0, 28));
    registry.addComponent(level, new HudText("level"));
    registry.addComponent(
      level,
      new Visual(
        new Text({
          fontSize: 30,
          fill: "#e8ecf8",
          fontFamily: "monospace",
          width: 1280,
          align: "center",
        }),
      ),
    );
    const lives = registry.spawnEntity();
    registry.addComponent(lives, new Position(60, 28));
    registry.addComponent(lives, new HudText("lives"));
    registry.addComponent(
      lives,
      new Visual(
        new Text({
          fontSize: 30,
          fill: "#e8ecf8",
          fontFamily: "monospace",
          width: 1160,
          align: "right",
        }),
      ),
    );

    const paddle = registry.spawnEntity();
    registry.addComponent(paddle, new Position(560, 660));
    registry.addComponent(paddle, new Box(160, 18));
    registry.addComponent(paddle, new Paddle(0.9));
    registry.addComponent(
      paddle,
      new Visual(new Rect({ width: 160, height: 18, fill: "#4aa3ff", cornerRadius: 6 })),
    );
    const ball = registry.spawnEntity();
    registry.addComponent(ball, new Position(631, 640));
    registry.addComponent(ball, new Box(18, 18));
    registry.addComponent(ball, new Velocity(0, 0));
    registry.addComponent(ball, new Ball());
    registry.addComponent(
      ball,
      new Visual(new Rect({ width: 18, height: 18, fill: "#ffffff", cornerRadius: 9 })),
    );

    registry.addSystem(movePaddle);
    registry.addSystem(moveBall);
    registry.addSystem(loseBall);
    registry.addSystem(updateHud);
  }
}
