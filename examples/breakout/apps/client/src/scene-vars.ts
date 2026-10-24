/**
 * The scene vars of the game. A var belongs to the scene that made it, and goes away when that
 * scene is unloaded, unless it is persistent.
 */
declare module "@nanoforge-dev/scene" {
  interface SceneVars {
    /** The best score, kept from one game to the next (persistent). @default 0 */
    best: number;
    /** Points of the current game (made by `Run`). @default 0 */
    score: number;
    /** Balls left in the current game (made by `Run`). @default 3 */
    lives: number;
    /** Number of the current level, shown in the top bar. @default 1 */
    level: number;
    /** Bricks of the level not broken yet. @default 0 */
    bricksLeft: number;
    /** Speed of the ball in this level, in pixels per millisecond. @default 0.45 */
    ballSpeed: number;
    /** The ball left the paddle. @default false */
    served: boolean;
    /** The pause menu is open: the game's systems wait. @default true */
    paused: boolean;
  }
}

export {};
