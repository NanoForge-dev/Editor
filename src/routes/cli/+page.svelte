<script lang="ts">
  import { resolve } from '$app/paths';
  import Logo from '$lib/assets/logo.png';
  import type { PageData } from './$types';
  import { deserialize } from '$app/forms';

  let { data }: { data: PageData } = $props();
  let projectRunning = $state(false);
</script>

<div class="h-screen flex flex-col gap-1">
  <header class="h-16 flex bg-neutral-900">
    <div class="h-full w-full flex">
      <a href={resolve('/')} class="h-full px-3 pb-1 pt-2">
        <img src={Logo} alt="Logo" class="h-full rounded-full" />
      </a>
      <div class="h-full w-full flex flex-col justify-between">
        {projectRunning || data.projectRunning ? 'Project running' : 'Project not running'}
        <form
          onsubmit={async (e) => {
            e.preventDefault();
            const response = await fetch('/cli?/isProjectRunning', {
              method: 'POST',
              body: JSON.stringify({}),
            });
            const result = deserialize(await response.text());
            if (result.type === 'success' && result.data) {
              projectRunning = result.data.projectRunning;
            }
          }}
        >
          <input type="submit" value="Check running status" />
        </form>
        <form
          onsubmit={async (e) => {
            e.preventDefault();
            const response = await fetch('/cli?/startDevProject', {
              method: 'POST',
              body: JSON.stringify({}),
            });
            const result = deserialize(await response.text());
            if (result.type === 'success' && result.data) {
              projectRunning = true;
            }
          }}
        >
          <input type="submit" value="Start Project" />
        </form>
        <form
          onsubmit={async (e) => {
            e.preventDefault();
            const response = await fetch('/cli?/stopProject', {
              method: 'POST',
              body: JSON.stringify({}),
            });
            const result = deserialize(await response.text());
            if (result.type === 'success' && result.data) {
              projectRunning = false;
            }
          }}
        >
          <input type="submit" value="Stop Project" />
        </form>
      </div>
    </div>
  </header>
</div>
