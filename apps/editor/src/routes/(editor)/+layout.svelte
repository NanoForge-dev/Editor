<script lang="ts">
  import type { Snippet } from 'svelte';

  import Loading from '$lib/editor/Loading.svelte';
  import { type Editor, createEditor } from '$lib/editor/create-editor';
  import { provideEditor } from '$lib/editor/editor-context';
  import { type ErrorDescription, errorCode, errorMessage } from '$lib/editor/error-description';

  const { children }: { children: Snippet } = $props();

  let editor = $state<Editor>();
  let error = $state<ErrorDescription>();
  let step = $state('Starting');
  let progress = $state(0);
  let description = $state<string>();
  const context = provideEditor();

  const retry = { label: 'Try again', primary: true, run: () => location.reload() };

  /** Startup failures, with what the user can do about them. */
  const describeStartupError = (reason: unknown): ErrorDescription =>
    errorCode(reason) === 'UNAVAILABLE'
      ? {
          title: "Can't reach the editor server",
          hint: 'Start it with nf editor in your project folder (or check your connection), then try again.',
          detail: errorMessage(reason),
          actions: [retry],
        }
      : {
          title: 'The editor failed to start',
          hint: 'Try again. If it keeps failing, restart the editor server.',
          detail: errorMessage(reason),
          actions: [retry],
        };

  $effect(() => {
    let disposed = false;
    createEditor((label, done, total, detail) => {
      step = label;
      progress = done / total;
      description = detail;
    })
      .then((created) => {
        if (disposed) return created.dispose();
        context.current = created;
        editor = created;
      })
      .catch((reason: unknown) => (error = describeStartupError(reason)));
    return () => {
      disposed = true;
      context.current?.dispose();
    };
  });
</script>

<svelte:head>
  <title>NanoForge Editor</title>
</svelte:head>

{#if editor}
  {@render children()}
{:else}
  <Loading {step} {description} {progress} {error} />
{/if}
