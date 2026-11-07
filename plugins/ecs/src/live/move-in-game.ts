import { ObservableValue } from '@nanoforge-dev/editor-sdk';

/** Context key of the Game screen's _Move entities_ tool (its pressed state). */
export const MOVE_IN_GAME_KEY = 'ecs.moveInGame';

/**
 * Whether the Game screen moves entities: pointer events go to the editor's overlay, which
 * outlines the entities and drags them, instead of the game.
 */
export const moveInGame = new ObservableValue(false);
