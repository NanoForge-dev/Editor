<script lang="ts">
  import { resolve } from '$app/paths';
  import Logo from '$lib/assets/logo.png';
  import CreateProject from '$lib/components/ProjectLoader/CreateProject.svelte';
  import LoadProject from '$lib/components/ProjectLoader/LoadProject.svelte';
  import { onMount } from 'svelte';
  import ProjectCache, {
    type ProjectDataCache,
  } from '$lib/components/Utils/LocalStorage/ProjectCache';
  import DefaultProjectCover from '$lib/assets/defaultProjectCover.png';
  import api from '$lib/components/Utils/api/api';
  import { goto } from '$app/navigation';
  import ProgressBar from '$lib/components/ProjectLoader/ProgressBar.svelte';

  let showCreateProject: boolean = $state(false);
  let showLoadProject: boolean = $state(false);
  let showLoadingProject: boolean = $state(false);

  let promisesFiles: Promise<void>[] = $state([]);

  let projectListCache: Array<ProjectDataCache> = $state([]);

  function handleCreateProjectPopup(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showCreateProject = !showCreateProject;
    }
  }
  function handleLoadProjectPopup(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showLoadProject = !showLoadProject;
    }
  }

  async function loadProject(projectPath: string) {
    const loadFormData = new FormData();
    loadFormData.append('projectPath', projectPath);

    await api.loadProject(loadFormData);
    promisesFiles = await api.downloadFiles();
    showLoadingProject = true;
  }

  async function loadCacheProject(project: ProjectDataCache) {
    try {
      await loadProject(project.path);
    } catch {
      ProjectCache.removeProject(project.name);
    }
  }

  onMount(async () => {
    projectListCache = ProjectCache.getProjects();

    const params = new URLSearchParams(window.location.search);

    const projectPath = params.get('projectPath');
    const projectId = params.get('projectId');

    if (!projectPath && !projectId) return;

    const formData = new FormData();

    if (projectPath) formData.append('projectPath', projectPath);
    if (projectId) formData.append('projectId', projectId);

    await api.loadProject(formData);
    await api.downloadFiles();
    await goto(resolve('/'));
  });
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
      class="w-full max-w-md md:max-w-lg lg:max-w-xl bg-black outline outline-neutral-800 p-8 rounded-xl shadow flex"
    >
      <div class="flex flex-col gap-4 items-center justify-center px-6">
        <button
          onclick={() => (showCreateProject = !showCreateProject)}
          onkeydown={handleCreateProjectPopup}
          class="cursor-pointer bg-neutral-900 w-48 h-8 rounded-md outline-2 outline-neutral-800 text-neutral-300"
          >Create new project</button
        >
        <button
          onclick={() => (showLoadProject = !showLoadProject)}
          onkeydown={handleLoadProjectPopup}
          class="cursor-pointer bg-neutral-900 w-48 h-8 rounded-md outline-2 outline-neutral-800 text-neutral-300"
          >Import project</button
        >
      </div>
      <div class="w-2px rounded-xl bg-neutral-900 mx-4 hidden md:block"></div>
      <div class="h-98 w-full flex flex-col items-center">
        {#if projectListCache.length > 0}
          <div class="flex flex-col w-full gap-4 items-center justify-start h-full">
            {#each projectListCache as project (project)}
              <button
                class="w-full bg-neutral-900 hover:bg-neutral-800 outline outline-neutral-800 flex gap-2 justify-start p-2 rounded-md cursor-pointer"
                onclick={() => loadCacheProject(project)}
              >
                <img
                  alt="{project.name} project image"
                  src={project.imageUrl ? project.imageUrl : DefaultProjectCover}
                  class="h-12 aspect-square"
                />
                <span class="flex flex-col w-full text-start">
                  <span class="font-medium text-neutral-200">{project.name}</span>
                  <span class="text-xs text-neutral-400">Last update today</span>
                </span>
              </button>
            {/each}
          </div>
          <button
            type="button"
            class="cursor-pointer text-sm text-neutral-600 hover:text-neutral-700"
            onclick={() => {
              ProjectCache.clearProjects();
              projectListCache = [];
            }}>Clear project cache</button
          >
        {:else}
          <div class="h-full w-fit flex items-center justify-center text-neutral-600 text-sm">
            <span>No project created</span>
          </div>
        {/if}
      </div>
    </div>
  </main>
</div>
<CreateProject bind:show={showCreateProject} callback={loadProject} />
<LoadProject bind:show={showLoadProject} callback={loadProject} />
<ProgressBar
  promises={promisesFiles}
  bind:show={showLoadingProject}
  callback={() => goto(resolve('/'))}
/>
