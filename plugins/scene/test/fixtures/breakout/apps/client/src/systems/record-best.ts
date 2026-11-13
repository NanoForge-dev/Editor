import type { Context } from "@nanoforge-dev/common";

/**
 * Keeps the best score (a persistent var).
 *
 * @returns Whether `score` is a new best score.
 */
export const recordBest = (ctx: Context, score: number): boolean => {
  const vars = ctx.scenes.vars;
  vars.init("best", 0, { persistent: true });
  if (score <= (vars.get("best") ?? 0)) return false;
  vars.set("best", score);
  return true;
};
