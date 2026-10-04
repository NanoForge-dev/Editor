import type { Context } from "@nanoforge-dev/common";
import type { Registry } from "@nanoforge-dev/ecs/client";
import type { Rect } from "@nanoforge-dev/graphics-2d";
import { InputEnum } from "@nanoforge-dev/input";

import { ARENA } from "../arena";
import { Ball } from "../components/ball";
import { Box } from "../components/box";
import { Brick } from "../components/brick";
import { Paddle } from "../components/paddle";
import { Position } from "../components/position";
import { Visual } from "../components/visual";
import { Velocity } from "../components/velocity";
import { justPressed } from "../keys";

/** The largest angle of a bounce on the paddle, from vertical, at its ends. */
const MAX_BOUNCE = (60 * Math.PI) / 180;
/** Longer ticks are cut to this, so the ball never goes through a brick. */
const MAX_DELTA = 32;

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const overlap = (a: Bounds, b: Bounds) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/**
 * Serves the ball with Space, moves it, and bounces it on the walls, the paddle and the bricks.
 * A broken brick adds its points to `score` and takes one from `bricksLeft`.
 *
 * @system
 * @side client
 */
export function moveBall(registry: Registry, ctx: Context) {
  const vars = ctx.scenes.vars;
  if (vars.has("paused")) return;
  const paddle = registry.getZipper([Paddle, Position, Box])[0];
  if (!paddle) return;
  const speed = vars.get("ballSpeed") ?? 0.5;
  const delta = Math.min(ctx.app.delta, MAX_DELTA);

  registry.getZipper([Ball, Position, Velocity, Box]).forEach(({ Position, Velocity, Box }) => {
    if (!vars.get("served")) {
      // On the paddle, until Space.
      Position.x = paddle.Position.x + (paddle.Box.width - Box.width) / 2;
      Position.y = paddle.Position.y - Box.height - 2;
      if (justPressed(ctx, InputEnum.Space)) {
        vars.set("served", true);
        Velocity.x = speed * Math.sin(MAX_BOUNCE / 2);
        Velocity.y = -speed * Math.cos(MAX_BOUNCE / 2);
      }
      return;
    }

    Position.x += Velocity.x * delta;
    Position.y += Velocity.y * delta;
    const ball = { x: Position.x, y: Position.y, width: Box.width, height: Box.height };

    // Walls
    if (Position.x < ARENA.left) {
      Position.x = ARENA.left;
      Velocity.x = Math.abs(Velocity.x);
    } else if (Position.x + Box.width > ARENA.right) {
      Position.x = ARENA.right - Box.width;
      Velocity.x = -Math.abs(Velocity.x);
    }
    if (Position.y < ARENA.top) {
      Position.y = ARENA.top;
      Velocity.y = Math.abs(Velocity.y);
    }

    // Paddle: the further from its middle, the wider the angle.
    const pad = { ...paddle.Position, width: paddle.Box.width, height: paddle.Box.height };
    if (Velocity.y > 0 && overlap(ball, pad)) {
      const offset = (ball.x + ball.width / 2 - (pad.x + pad.width / 2)) / (pad.width / 2);
      const angle = Math.max(-1, Math.min(1, offset)) * MAX_BOUNCE;
      Velocity.x = speed * Math.sin(angle);
      Velocity.y = -speed * Math.cos(angle);
      Position.y = pad.y - Box.height;
      return;
    }

    // Bricks: one per tick, bounced on the side it went in the least.
    const hit = registry
      .getZipper([Brick, Position, Box, Visual])
      .find(
        (brick) =>
          brick.Brick.hits > 0 &&
          overlap(ball, { ...brick.Position, width: brick.Box.width, height: brick.Box.height }),
      );
    if (!hit) return;
    const inX = Math.min(
      ball.x + ball.width - hit.Position.x,
      hit.Position.x + hit.Box.width - ball.x,
    );
    const inY = Math.min(
      ball.y + ball.height - hit.Position.y,
      hit.Position.y + hit.Box.height - ball.y,
    );
    if (inX < inY) Velocity.x = -Velocity.x;
    else Velocity.y = -Velocity.y;

    hit.Brick.hits--;
    const shape = hit.Visual.shape as Rect;
    if (hit.Brick.hits > 0) {
      shape.opacity(0.55);
      return;
    }
    shape.visible(false);
    vars.set("score", (vars.get("score") ?? 0) + hit.Brick.points);
    vars.set("bricksLeft", (vars.get("bricksLeft") ?? 1) - 1);
  });
}
