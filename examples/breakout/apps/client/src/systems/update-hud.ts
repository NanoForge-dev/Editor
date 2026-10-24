import type { Context } from "@nanoforge-dev/common";
import type { Registry } from "@nanoforge-dev/ecs/client";
import type { Text } from "@nanoforge-dev/graphics-2d";

import { HudText } from "../components/hud-text";
import { Visual } from "../components/visual";

const LABELS = { score: "Score", lives: "Lives", level: "Level" } as const;

/**
 * Writes the score, the lives and the level in the top bar.
 *
 * @system
 * @side client
 */
export function updateHud(registry: Registry, ctx: Context) {
  registry.getZipper([HudText, Visual]).forEach(({ HudText, Visual }) => {
    const show = (HudText as HudText).show;
    const value = ctx.scenes.vars.get(show) ?? "-";
    (Visual.shape as Text).text(`${LABELS[show]} ${value}`);
  });
}
