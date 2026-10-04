import type { ClientRunOptions } from "@nanoforge-dev/common";
import { NanoforgeFactory } from "@nanoforge-dev/core";
import { EcsLibrary } from "@nanoforge-dev/ecs/client";
import { EditorLibrary } from "@nanoforge-dev/editor-lib";
import { Graphics2DLibrary, Rect } from "@nanoforge-dev/graphics-2d";
import { InputLibrary } from "@nanoforge-dev/input";
import { SceneLibrary } from "@nanoforge-dev/scene";

import { HEIGHT, WIDTH } from "./arena";
import { layer } from "./layer";
import "./scene-vars";
import { GameOver } from "./scenes/game-over";
import { Level1, Level2, Level3 } from "./scenes/levels";
import { Menu } from "./scenes/menu";
import { Pause } from "./scenes/pause";
import { Run } from "./scenes/run";
import { Victory } from "./scenes/victory";
import { drawVisuals } from "./systems/draw-visuals";

export const main = async (options: ClientRunOptions): Promise<void> => {
  const app = NanoforgeFactory.createClient({
    tickRate: 60,
    viewport: { width: WIDTH, height: HEIGHT, fit: "contain" },
  });
  const graphics = new Graphics2DLibrary();
  const ecs = new EcsLibrary();

  app.use(graphics);
  app.use(ecs);
  app.use(new InputLibrary());
  // Every entity on screen belongs to a scene: the menu is loaded at the first tick.
  app.use(
    new SceneLibrary({
      initial: Menu,
      scenes: { Menu, Run, Level1, Level2, Level3, Pause, GameOver, Victory },
    }),
  );
  // The editor's bridge: pause, step, the live world and the inspectors. It does nothing when
  // the game is not started by the editor.
  app.use(new EditorLibrary());

  await app.init(options);

  graphics.stage.add(layer);
  layer.add(new Rect({ width: WIDTH, height: HEIGHT, fill: "#10141f" }));

  const registry = ecs.registry;
  registry.addSystem(drawVisuals);

  await app.run();
};
