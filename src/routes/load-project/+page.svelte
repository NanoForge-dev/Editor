<script lang="ts">
  import { resolve } from '$app/paths';
  import Logo from '$lib/assets/logo.png';
  import { clearDB } from '$lib/components/Utils/Storage/db';

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
  let showAdvancedSettings: boolean = $state(false);
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
    <div
      class="w-full max-w-sm md:max-w-md lg:max-w-lg bg-black outline outline-neutral-800 p-8 rounded-xl shadow flex"
    >
      <div class="flex flex-col gap-4 items-center justify-center px-6">
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
      <div class="h-98 flex w-1/2 mx-6 flex-col items-center">
        <div class="h-full w-fit flex items-center justify-center text-neutral-300 text-sm">
          <span>No project created</span>
        </div>
      </div>
    </div>
  </main>
</div>

<div
  aria-hidden="true"
  class={showPopup
    ? 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
    : 'hidden'}
  onclick={(e) => e.target === e.currentTarget && (showPopup = false)}
  onkeydown={handleClose}
>
  <form
    class="bg-black outline outline-neutral-900 rounded-xl p-6 w-full max-w-sm shadow-2xl flex flex-col"
    aria-labelledby="project-title"
    onsubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      fetch('/cli?/createProject', {
        method: 'POST',
        body: JSON.stringify({
          projectPath: formData.get('projectPath'),
          projectName: formData.get('projectName'),
          packageManager: formData.get('packageManager'),
          language: formData.get('language'),
          strictTypeChecking: formData.get('strictTypeChecking') ?? false,
          multiplayerServer: formData.get('multiplayerServer') ?? false,
          skipDependencyInstallation: formData.get('skipDependencyInstallation') ?? false,
          dockerContainerization: formData.get('dockerContainerization') ?? false,
        }),
      });
    }}
  >
    <span id="project-title" class="text-2xl font-bold mb-8 text-center">New project</span>
    <span class="mb-4 flex gap-4 items-end">
      <span class="block text-sm mb-1 text-neutral-300 w-1/2">Project Name</span>
      <input
        name="projectName"
        class="w-1/2 rounded-lg px-3 py-2 outline outline-neutral-800 text-sm"
        placeholder="Project name"
      />
    </span>
    <span class="mb-4 flex gap-4 items-end">
      <span class="block text-sm mb-1 text-neutral-300 w-1/2">Project local path</span>
      <input
        name="projectPath"
        class="w-1/2 rounded-lg px-3 py-2 outline outline-neutral-800 text-sm"
        placeholder="Project path"
      />
    </span>
    <div class="flex w-full justify-center my-4">
      <button
        class="text-sm w-fit font-semibold mb-4 cursor-pointer hover:text-neutral-300"
        onclick={() => (showAdvancedSettings = !showAdvancedSettings)}
      >
        <span>Advanced settings</span>
        <span
          class={showAdvancedSettings
            ? 'i-ic-baseline-arrow-drop-up'
            : 'i-ic-baseline-arrow-drop-down'}
        ></span>
      </button>
    </div>
    {#if showAdvancedSettings}
      <span class="mb-4 flex gap-4 items-end">
        <label for="packageManagerId" class="block text-sm mb-1 text-neutral-300 w-1/2"
          >Package manager</label
        >
        <select
          name="packageManager"
          id="packageManagerId"
          class="bg-neutral-900 px-3 py-2 rounded-md cursor-pointer w-1/2"
        >
          <option value="npm">npm</option>
          <option value="yarn">yarn</option>
          <option value="pnpm">pnpm</option>
          <option value="bun">bun</option>
        </select>
      </span>
      <span class="mb-4 flex gap-4 items-end">
        <label for="languageId" class="block text-sm mb-1 text-neutral-300 w-1/2"
          >Package manager</label
        >
        <select
          name="language"
          id="languageId"
          class="bg-neutral-900 px-3 py-2 rounded-md cursor-pointer w-1/2"
        >
          <option value="js">JS</option>
          <option value="ts">TS</option>
        </select>
      </span>
      <span class="mb-4 flex gap-4 items-end h-fit">
        <label for="strictTypeCheckingId" class="block text-sm text-neutral-300 w-1/2"
          >Strict Type Checking</label
        >
        <input type="checkbox" name="strictTypeChecking" value="true" id="strictTypeCheckingId" />
      </span>
      <span class="mb-4 flex gap-4 items-end h-fit">
        <label for="multiplayerServerId" class="block text-sm text-neutral-300 w-1/2"
          >Strict Multiplayer Server</label
        >
        <input type="checkbox" name="multiplayerServer" value="true" id="multiplayerServerId" />
      </span>
      <span class="mb-4 flex gap-4 items-end h-fit">
        <label for="skipDependencyInstallationId" class="block text-sm text-neutral-300 w-1/2"
          >Skip Dependency Installation</label
        >
        <input
          type="checkbox"
          name="skipDependencyInstallation"
          value="true"
          id="skipDependencyInstallationId"
        />
      </span>
      <span class="mb-4 flex gap-4 items-end h-fit">
        <label for="dockerContainerizationId" class="block text-sm text-neutral-300 w-1/2"
          >Docker containerization</label
        >
        <input
          type="checkbox"
          name="dockerContainerization"
          value="true"
          id="dockerContainerizationId"
        />
      </span>
    {/if}

    <div class="flex gap-3 justify-end mt-4">
      <button
        onclick={() => (showPopup = false)}
        class="px-4 py-2 text-neutral-200 hover:text-neutral-400 focus:outline-none focus:ring-2 cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        class="bg-purple-800 text-white px-4 py-2 rounded-lg hover:bg-purple-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        Créer
      </button>
    </div>
  </form>
</div>
