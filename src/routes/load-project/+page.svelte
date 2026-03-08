<script lang="ts">
  import { resolve } from '$app/paths';
  import Logo from '$lib/assets/logo.png';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<div class="h-screen flex flex-col gap-1">
  <header class="h-16 flex bg-neutral-900">
    <div class="h-full w-full flex">
      <a href={resolve('/')} class="h-full px-3 pb-1 pt-2">
        <img src={Logo} alt="Logo" class="h-full rounded-full" />
      </a>
      <div class="h-full w-full flex flex-col justify-between">
        {data.success ? 'Project loading' : 'Error: ' + data.errorMsg}
      </div>
    </div>
  </header>
</div>
