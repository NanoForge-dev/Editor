<script lang="ts">
  import api from '$lib/components/Utils/api/api';
  import Play from '$lib/assets/play.png';
  import Stop from '$lib/assets/stop.png';
  import { projectIsUpdatedStore } from '$lib/components/Stores/projectIsUpdated';

  let isPlaying = $state(false);

  let iframeGame: HTMLIFrameElement;

  async function LoadIframeGame() {
    iframeGame.src = 'http://localhost:3000';
  }

  async function uploadFiles() {
    await api.uploadFiles();
    $projectIsUpdatedStore = true;
  }

  async function playGame() {
    await uploadFiles();
    await api.playProject();
    setTimeout(() => {
      LoadIframeGame();
    }, 1000);
    isPlaying = true;
  }

  async function stopGame() {
    await api.stopProject();
    isPlaying = false;
  }
</script>

<div class="h-full w-full bg-neutral-800 flex flex-col">
  <div class="py-2 px-2 h-16 flex justify-center">
    <div class="bg-neutral-600 rounded-md p-1">
      <button
        aria-label="Play"
        class="h-fit {!isPlaying ? 'cursor-pointer hover:bg-neutral-700' : ''}  rounded-md p-2"
        onclick={playGame}
      >
        <img src={Play} class="h-fit w-5 {isPlaying ? 'filter grayscale brightness-300' : ''}" />
      </button>
      <button
        aria-label="Stop"
        class="h-fit {isPlaying ? 'cursor-pointer hover:bg-neutral-700' : ''} rounded-md p-2"
        onclick={stopGame}
      >
        <img
          src={Stop}
          class="h-fit w-5 {!isPlaying ? 'filter grayscale brightness-300' : ''}"
          alt=""
        />
      </button>
    </div>
    <!--<button
      aria-label="uploadFiles"
      onclick={uploadFiles}
      class="h-full flex justify-center items-center rounded-md text-sm p-1 hover:bg-neutral-900 text-neutral-300 cursor-pointer"
    >
      {#if isUploading}
        <Spinner class="h-fit" />
      {:else}
        <span
          class={$projectIsUpdatedStore ? 'i-ic-baseline-file-upload' : 'i-ic-baseline-file-upload'}
        ></span>
      {/if}
    </button>-->
  </div>
  <div class="h-full w-full bg-black mb-8">
    <iframe
      bind:this={iframeGame}
      title="game-screen"
      src="http://localhost:3000/"
      class="w-full h-full max-w-full max-h-full object-contain {isPlaying ? '' : 'hidden'}"
      allowfullscreen
    ></iframe>
  </div>
</div>
