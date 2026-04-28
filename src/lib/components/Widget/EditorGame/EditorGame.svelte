<script lang="ts">
  import ProgressBar from '$lib/components/ProjectLoader/ProgressBar.svelte';
  import { fetchGameProps } from '$lib/loader/client/fetchGameProps';
  import { coreEvents, runGame } from '$lib/loader/client/game';
  import { EventTypeEnum } from '$lib/loader/client/types/event-emitter.type';
  import { localApi } from '$lib/components/Utils/api/api';
  import { GameState } from '$lib/components/Widget/EditorGame/game.svelte';

  let canvas: HTMLCanvasElement;

  let gameState = $state(GameState.INIT_STATE);

  let loadingPromises: Promise<unknown>[] = $state([]);

  async function playGameFromServer() {
    gameState = GameState.RELOAD_FROM_SERVER;
    await localApi.buildProject();
    loadingPromises = await fetchGameProps();
    await Promise.all(loadingPromises);
    loadingPromises = [];
    gameState = GameState.PLAY;
    runGame(canvas);
  }

  async function playGameFromSave() {
    gameState = GameState.RELOAD_FROM_SAVE;
    gameState = GameState.PLAY;
    runGame(canvas);
  }

  async function unpauseGame() {
    gameState = GameState.PLAY;
    coreEvents.emitEvent(EventTypeEnum.UNPAUSE_GAME);
  }

  async function pauseGame() {
    gameState = GameState.PAUSE;
    coreEvents.emitEvent(EventTypeEnum.PAUSE_GAME);
  }

  async function stopGame() {
    gameState = GameState.STOP;
    coreEvents.emitEvent(EventTypeEnum.STOP_GAME);
  }
</script>

<div class="editor-game">
  <ProgressBar
    title="Loading game"
    promises={loadingPromises}
    show={gameState === GameState.RELOAD_FROM_SERVER || gameState === GameState.RELOAD_FROM_SAVE}
  />
  <div class="h-full w-full bg-neutral-800 flex flex-col">
    <div class="p-2 items-center flex justify-center">
      <div class="h-9 bg-neutral-600 rounded-md p-1">
        {#if gameState === GameState.PAUSE || gameState === GameState.INIT_STATE || gameState === GameState.STOP}
          <button
            aria-label="Play"
            class="h-fit cursor-pointer hover:bg-neutral-700 rounded-md"
            onclick={gameState === GameState.INIT_STATE
              ? playGameFromServer
              : gameState === GameState.STOP
                ? playGameFromSave
                : unpauseGame}
          >
            <span class="block h-7 w-7 i-ic-round-play-arrow text-green"></span>
          </button>
        {:else}
          <button
            aria-label="Pause"
            class="h-fit cursor-pointer hover:bg-neutral-700 rounded-md"
            onclick={pauseGame}
          >
            <span class="block h-7 w-7 i-ic-round-pause text-yellow"></span>
          </button>
        {/if}
        <button
          aria-label="Stop"
          class="h-fit {gameState === GameState.PLAY
            ? 'cursor-pointer hover:bg-neutral-700'
            : ''} rounded-md"
          onclick={stopGame}
        >
          <span
            class="block h-7 w-7 i-ic-round-stop {gameState === GameState.PLAY
              ? 'text-red-600'
              : 'text-red-950'}"
          ></span>
        </button>

        <button
          aria-label="Reload from server"
          class="h-fit {gameState !== GameState.RELOAD_FROM_SERVER
            ? 'cursor-pointer hover:bg-neutral-700'
            : ''} rounded-md"
          onclick={playGameFromServer}
        >
          <span
            class="block h-7 w-7 i-ic-round-autorenew {gameState !== GameState.RELOAD_FROM_SERVER
              ? 'text-blue-500'
              : 'text-blue-950'}"
          ></span>
        </button>
      </div>
    </div>
    <div class="h-full w-full bg-black mb-8">
      <canvas class="editor-game-canvas" bind:this={canvas}> </canvas>
    </div>
  </div>
</div>

<style>
  .editor-game,
  .editor-game-canvas {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
  }
</style>
