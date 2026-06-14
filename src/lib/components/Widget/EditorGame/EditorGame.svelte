<script lang="ts">
  import { ProgressBar } from '../../project-loader';
  import { GameState } from '$lib/components/Widget/EditorGame/game.svelte';
  import { useProject } from '$lib/client/project';
  import { CoreEvents } from '$lib/client/event';

  let container: HTMLDivElement;

  let gameState = $state(GameState.INIT_STATE);
  const { event, loader } = useProject();

  let loadingPromises: Promise<unknown>[] = $state([]);

  async function playGameFromServer() {
    gameState = GameState.RELOAD_FROM_SERVER;
    await loader.build();
    await loader.start(container);
    gameState = GameState.PLAY;
  }

  async function playGameFromSave() {
    gameState = GameState.RELOAD_FROM_SAVE;
    await loader.start(container);
    gameState = GameState.PLAY;
  }

  async function unpauseGame() {
    gameState = GameState.PLAY;
    event.emit(CoreEvents.UNPAUSE_GAME);
  }

  async function pauseGame() {
    gameState = GameState.PAUSE;
    event.emit(CoreEvents.PAUSE_GAME, 10);
  }

  async function stopGame() {
    gameState = GameState.STOP;
    event.emit(CoreEvents.STOP_GAME);
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
              ? 'text-sky-600'
              : 'text-sky-950'}"
          ></span>
        </button>
      </div>
    </div>
    <div class="h-full w-full bg-black mb-8">
      <div class="editor-game-container" bind:this={container}></div>
    </div>
  </div>
</div>

<style>
  .editor-game,
  .editor-game-container {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
  }
</style>
