<script lang="ts">
  import { Progress } from '$lib/components/ui/progress';

  interface Props {
    title: string;
    promises: Promise<unknown>[];
    show: boolean;
    callback?: () => unknown;
  }
  let { title, promises, show = $bindable(), callback }: Props = $props();

  let total: number = $state(0);
  let completed: number = $state(0);

  $effect(() => {
    completed = 0;
    total = promises.length;
    promises.forEach((promise) => {
      promise.finally(() => {
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
>
  <div
    class="bg-black outline outline-neutral-900 rounded-xl p-6 w-full max-w-sm shadow-2xl flex flex-col"
  >
    <span id="project-title" class="text-2xl font-bold mb-8 text-center">{title}</span>
    <Progress value={(completed / total) * 100} />
  </div>
</div>
