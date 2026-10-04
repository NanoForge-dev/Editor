import { join } from 'node:path';

/**
 * Where the e2e projects live: `e2e/.workspace` by default, another folder of `e2e/` with
 * `E2E_WORKSPACE` (so a run does not wipe a workspace someone has open in a dev editor).
 */
export const WORKSPACE = join(import.meta.dirname, process.env.E2E_WORKSPACE ?? '.workspace');
export const PONG = join(WORKSPACE, 'pong');
export const GAME = join(WORKSPACE, 'game');
/** The breakout example (scenes), when the engine has the scene module. */
export const BREAKOUT = join(WORKSPACE, 'breakout');
/** The folder the editor server uses as the registry of plugins and packages. */
export const REGISTRY = join(WORKSPACE, '.registry');
