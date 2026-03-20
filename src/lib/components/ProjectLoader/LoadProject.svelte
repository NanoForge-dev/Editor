<script lang="ts">
  import api from '$lib/components/Utils/api/api';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  interface Props {
    show: boolean;
  }
  let { show = $bindable() }: Props = $props();

  let error: string = $state('');

  function handleClose(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      show = false;
    }
  }

  export async function loadProject(formData: FormData) {
    try {
      const projectPath = formData.get('projectPath');

      if (projectPath) {
        const loadFormData = new FormData();
        loadFormData.append('projectPath', projectPath.toString());

        await api.loadProject(loadFormData);
        await api.downloadFiles();
        await goto(resolve('/'));
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
    class="bg-black outline outline-neutral-900 rounded-xl p-6 w-full max-w-sm shadow-2xl flex flex-col"
    aria-labelledby="project-title"
    onsubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      loadProject(formData);
    }}
  >
    <span id="project-title" class="text-2xl font-bold mb-8 text-center">Load project</span>
    <span class="mb-4 flex gap-4 items-end">
      <span class="block text-sm mb-1 text-neutral-300 w-1/2">Project local path</span>
      <input
        name="projectPath"
        class="w-1/2 rounded-lg px-3 py-2 outline outline-neutral-800 text-sm"
        placeholder="Project path"
      />
    </span>

    <span class="w-full text-center text-red-400 text-sm">{error}</span>

    <div class="flex gap-3 justify-end mt-4">
      <button
        onclick={() => (show = false)}
        class="px-4 py-2 text-neutral-200 hover:text-neutral-400 focus:outline-none focus:ring-2 cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        class="bg-purple-800 text-white px-4 py-2 rounded-lg hover:bg-purple-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        Load
      </button>
    </div>
  </form>
</div>
