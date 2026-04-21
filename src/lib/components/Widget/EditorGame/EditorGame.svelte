<script lang="ts">
  import ProgressBar from '$lib/components/ProjectLoader/ProgressBar.svelte';
  import { fetchGameProps } from '$lib/loader/client/fetchGameProps';
  import { coreEvents, runGame } from '$lib/loader/client/game';
  import Play from '$lib/assets/play.png';
  import Stop from '$lib/assets/stop.png';
  import Reload from '$lib/assets/reload.png';
  import { EventTypeEnum } from '$lib/loader/client/types/event-emitter.type';
  import { localApi } from '$lib/components/Utils/api/api.ts';

  let canvas: HTMLCanvasElement;

  const GameStateEnum = {
    INIT_STATE: 0,
    RELOAD_FROM_SERVER: 1,
    RELOAD_FROM_SAVE: 2,
    PLAY: 3,
    PAUSE: 4,
  };
  let gameState = $state(GameStateEnum.INIT_STATE);

  let loadingPromises: Promise<unknown>[] = $state([]);

  async function runGameFromServer() {
    gameState = GameStateEnum.RELOAD_FROM_SERVER;
    await localApi.buildProject();
    loadingPromises = await fetchGameProps();
    await Promise.all(loadingPromises);
    loadingPromises = [];
    gameState = GameStateEnum.PLAY;
    runGame(canvas);
  }

  async function runGameFromSave() {
    gameState = GameStateEnum.RELOAD_FROM_SAVE;
    gameState = GameStateEnum.PLAY;
    runGame(canvas);
  }

  async function sendEvent(event: string) {
    coreEvents.emitEvent(event);
  }

  async function stopGame() {
    gameState = GameStateEnum.PAUSE;
    coreEvents.emitEvent('pause-game');
  }
</script>

<div class="editor-game">
  <ProgressBar
    title="Loading game"
    promises={loadingPromises}
    show={gameState === GameStateEnum.RELOAD_FROM_SERVER ||
      gameState === GameStateEnum.RELOAD_FROM_SAVE}
  />
  <div class="h-full w-full bg-neutral-800 flex flex-col">
    <div class="py-2 px-2 h-16 flex justify-center">
      <div class="bg-neutral-600 rounded-md p-1">
        <button
          aria-label="Hot Reload"
          class="h-fit {gameState === GameStateEnum.PLAY
            ? 'cursor-pointer hover:bg-neutral-700'
            : ''} rounded-md p-2"
          onclick={() => sendEvent(EventTypeEnum.HOT_RELOAD)}
        >
          <img
            src={Stop}
            class="h-fit w-5 {gameState !== GameStateEnum.PLAY
              ? 'filter grayscale brightness-300'
              : ''}"
            alt="Hot Reload"
          />
        </button>
        <button
          aria-label="Play"
          class="h-fit {gameState !== GameStateEnum.PLAY
            ? 'cursor-pointer hover:bg-neutral-700'
            : ''}  rounded-md p-2"
          onclick={gameState === GameStateEnum.INIT_STATE ? runGameFromServer : runGameFromSave}
        >
          <img
            src={Play}
            class="h-fit w-5 {gameState === GameStateEnum.PLAY
              ? 'filter grayscale brightness-300'
              : ''}"
            alt="Play Game"
          />
        </button>
        <button
          aria-label="Stop"
          class="h-fit {gameState === GameStateEnum.PLAY
            ? 'cursor-pointer hover:bg-neutral-700'
            : ''} rounded-md p-2"
          onclick={stopGame}
        >
          <img
            src={Stop}
            class="h-fit w-5 {gameState !== GameStateEnum.PLAY
              ? 'filter grayscale brightness-300'
              : ''}"
            alt="Stop"
          />
        </button>

        <button
          aria-label="Reload from server"
          class="h-fit {gameState !== GameStateEnum.RELOAD_FROM_SERVER
            ? 'cursor-pointer hover:bg-neutral-700'
            : ''} rounded-md p-2"
          onclick={runGameFromServer}
        >
          <img
            src={Reload}
            class="h-fit w-5 {gameState === GameStateEnum.RELOAD_FROM_SERVER
              ? 'filter grayscale brightness-300'
              : ''}"
            alt="Reload from server"
          />
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
