<script lang="ts">
  import { localApi } from '$lib/components/Utils/api/api';
  import ProjectCache from '$lib/components/Utils/LocalStorage/ProjectCache';
  import ProgressBar from '$lib/components/ProjectLoader/ProgressBar.svelte';

  interface Props {
    show: boolean;
    callback?: (projectPath: string) => void;
  }
  let { show = $bindable(), callback }: Props = $props();

  let projectLoading: Promise<void> | null = $state(null);
  let formElem: HTMLFormElement | undefined = $state();
  let createGitRepository: boolean = $state(false);

  let showAdvancedSettings: boolean = $state(false);
  let error: string = $state('');

  function handleClose(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      show = false;
    }
  }

  async function newProject() {
    if (!formElem) return;
    try {
      const projectFormData = new FormData(formElem);
      const projectPath = projectFormData.get('projectPath');
      const projectName = projectFormData.get('projectName');

      if (projectPath && projectName) {
        const newProjectPath = projectPath.toString() + '/' + projectName.toString();

        ProjectCache.addProject({
          name: projectName.toString(),
          path: newProjectPath,
          imageUrl: '',
        });

        callback?.(newProjectPath);
      }
    } catch (err: any) {
      error = err;
    }
  }
</script>

<div
  aria-hidden="true"
  class={show
    ? 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
    : 'hidden'}
  onclick={(e) => e.target === e.currentTarget && (show = false)}
  onkeydown={handleClose}
>
  <form
    bind:this={formElem}
    class="bg-black outline outline-neutral-900 rounded-xl p-6 w-full max-w-sm shadow-2xl flex flex-col"
    aria-labelledby="project-title"
    onsubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      projectLoading = localApi.createProject(formData);
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
        type="button"
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
    <div class="flex flex-col gap-4 {showAdvancedSettings ? '' : 'hidden'}">
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
        <label for="languageId" class="block text-sm mb-1 text-neutral-300 w-1/2">Language</label>
        <select
          name="language"
          id="languageId"
          class="bg-neutral-900 px-3 py-2 rounded-md cursor-pointer w-1/2"
        >
          <option value="ts">TS</option>
          <option value="js">JS</option>
        </select>
      </span>
      <span class="mb-4 flex gap-4 items-end h-fit">
        <label for="multiplayerServerId" class="block text-sm text-neutral-300 w-1/2"
          >Multiplayer Server</label
        >
        <input type="checkbox" name="multiplayerServer" value="true" id="multiplayerServerId" />
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
      <span class="mb-4 flex gap-4 items-end h-fit">
        <label for="createGitRepositoryId" class="block text-sm text-neutral-300 w-1/2"
          >Create Git Repository</label
        >
        <input
          type="checkbox"
          name="createGitRepository"
          bind:checked={createGitRepository}
          id="createGitRepositoryId"
        />
      </span>
      {#if createGitRepository}
        <span class="mb-4 flex gap-4 items-end">
          <span class="block text-sm mb-1 text-neutral-300 w-1/2">Git Remote</span>
          <input
            name="gitRemote"
            class="w-1/2 rounded-lg px-3 py-2 outline outline-neutral-800 text-sm"
            placeholder="Git Remote"
          />
        </span>
      {/if}
    </div>

    <span class="w-full text-center text-red-400 text-sm">{error}</span>

    <div class="flex gap-3 justify-end mt-4">
      <button
        type="button"
        onclick={() => (show = false)}
        class="px-4 py-2 text-neutral-200 hover:text-neutral-400 cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        class="bg-purple-800 text-white px-4 py-2 rounded-lg hover:bg-purple-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        Create
      </button>
    </div>
  </form>
</div>
{#if projectLoading !== null}
  <ProgressBar
    title="Creating project"
    promises={[projectLoading]}
    show={true}
    callback={() => newProject()}
  />
{/if}
