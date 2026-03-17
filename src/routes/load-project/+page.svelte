<script lang="ts">
  import { resolve } from '$app/paths';
  import Logo from '$lib/assets/logo.png';
  import { clearDB } from '$lib/components/Utils/Storage/db';

  async function createProject() {
    await clearDB();
    if (projectName.trim()) {
      window.location.href = `/load-project?projectPath=${encodeURIComponent(projectName)}`;
      showPopup = false;
    }
  }

  export function importProject() {
    clearDB();
  }

  function handlePopupToggle(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showPopup = !showPopup;
    }
  }

  function handleClose(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      showPopup = false;
    }
  }

  let showPopup: boolean = $state(false);
  let projectName: string = $state('');
</script>

<div class="min-h-screen w-full flex flex-col gap-1">
  <header class="h-16 flex bg-neutral-900">
    <div class="h-full w-full flex">
      <a href={resolve('/')} class="h-full px-3 pb-1 pt-2">
        <img src={Logo} alt="Logo" class="h-full rounded-full" />
      </a>
    </div>
  </header>
  <main class="flex-1 flex items-center justify-center px-4">
    <div class="w-full max-w-sm md:max-w-md lg:max-w-lg bg-black p-8 rounded-xl shadow flex">
      <div class="flex flex-col gap-4 items-center justify-center">
        <button
          onclick={() => (showPopup = !showPopup)}
          onkeydown={handlePopupToggle}
          class="cursor-pointer bg-neutral-900 w-48 h-8 rounded-md outline-2 outline-neutral-800 text-neutral-300"
          >Create new project</button
        >
        <button
          class="cursor-pointer bg-neutral-900 w-48 h-8 rounded-md outline-2 outline-neutral-800 text-neutral-300"
          >Import project</button
        >
      </div>
      <div class="w-2px rounded-xl bg-neutral-900 mx-4 hidden md:block"></div>
      <div class="h-98 flex w-full flex-col">
        <div class="h-full w-full flex items-center justify-center text-neutral-300 text-sm">
          <span>No project created</span>
        </div>
      </div>
    </div>
  </main>
</div>

<button
  class={showPopup
    ? 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
    : 'hidden'}
  type="button"
  onclick={(e) => e.target === e.currentTarget && (showPopup = false)}
  onkeydown={handleClose}
>
  <span
    class="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="project-title"
  >
    <span id="project-title" class="text-xl font-bold mb-4">Nouveau projet</span>

    <!-- Input -->
    <span class="mb-4">
      <span class="block text-sm font-medium mb-2">Nom du projet</span>
      <input
        bind:value={projectName}
        class="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Mon super projet"
      />
    </span>

    <!-- Boutons avec type="button" -->
    <span class="flex gap-3 justify-end">
      <span
        onclick={() => (showPopup = false)}
        class="px-4 py-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
      >
        Annuler
      </span>
      <span
        onclick={createProject}
        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Créer
      </span>
    </span>
  </span>
</button>
