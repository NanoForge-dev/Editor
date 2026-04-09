<script lang="ts">
  import { Progressbar } from 'flowbite-svelte';

  interface Props {
    title: string;
    promises: Promise<void>[];
    show: boolean;
    callback?: () => void;
  }
  let { title, promises, show = $bindable(), callback }: Props = $props();

  let total: number = $state(0);
  let completed: number = $state(0);

  function handleClose(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      show = false;
    }
  }

  $effect(() => {
    total = promises.length;
    promises.forEach((promise) => {
      promise.then(() => {
        completed += 1;
        if (completed === total && total > 0) {
          callback?.();
        }
      });
    });
  });
</script>

<div
  aria-hidden="true"
  class={show
    ? 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
    : 'hidden'}
  onclick={(e) => e.target === e.currentTarget && (show = false)}
  onkeydown={handleClose}
>
  <div
    class="bg-black outline outline-neutral-900 rounded-xl p-6 w-full max-w-sm shadow-2xl flex flex-col"
  >
    <span id="project-title" class="text-2xl font-bold mb-8 text-center">{title}</span>
    <Progressbar progress={(completed / total) * 100} />
  </div>
</div>
