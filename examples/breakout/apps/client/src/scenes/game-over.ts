import type { Context } from "@nanoforge-dev/common";
import type { Registry } from "@nanoforge-dev/ecs/client";
import { EcsScene } from "@nanoforge-dev/ecs/scene";
import { Text } from "@nanoforge-dev/graphics-2d";
import type { SceneLoadContext } from "@nanoforge-dev/scene";

import { Position } from "../components/position";
import { Visual } from "../components/visual";
import { backToMenu } from "../systems/back-to-menu";
import { recordBest } from "../systems/record-best";

/**
 * Shown when the last life is lost, with the score. It is a root scene: loading it unloads the level and `Run`, whose vars (`score`,
 * `lives`…) go with them, so the score comes as a param.
 *
 * @scene
 * @side client
 * @vars best
 */
export class GameOver extends EcsScene<{
  /** The score of the game that ended. */
  score: number;
}> {
  override setup(
    registry: Registry,
    ctx: Context,
    { params }: SceneLoadContext<{ score: number }>,
  ) {
    const score = params?.score ?? 0;
    const record = recordBest(ctx, score);

    const title = registry.spawnEntity();
    registry.addComponent(title, new Position(0, 200));
    registry.addComponent(
      title,
      new Visual(
        new Text({
          text: "Game over",
          fontSize: 96,
          fill: "#eb4d4b",
          fontFamily: "monospace",
          fontStyle: "bold",
          width: 1280,
          align: "center",
        }),
      ),
    );
    const scoreText = registry.spawnEntity();
    registry.addComponent(scoreText, new Position(0, 340));
    registry.addComponent(
      scoreText,
      new Visual(
        new Text({
          text: `Score ${score}${record ? " (new best!)" : ""}`,
          fontSize: 40,
          fill: "#e8ecf8",
          fontFamily: "monospace",
          width: 1280,
          align: "center",
        }),
      ),
    );
    const prompt = registry.spawnEntity();
    registry.addComponent(prompt, new Position(0, 520));
    registry.addComponent(
      prompt,
      new Visual(
        new Text({
          text: "Press Enter",
          fontSize: 30,
          fill: "#8a93ad",
          fontFamily: "monospace",
          width: 1280,
          align: "center",
        }),
      ),
    );

    registry.addSystem(backToMenu);
  }
}
