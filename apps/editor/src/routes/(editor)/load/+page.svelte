<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { ProjectRef } from '@nanoforge-dev/editor-protocol';

  import Loading from '$lib/editor/Loading.svelte';
  import { getEditor } from '$lib/editor/editor-context';
  import {
    type ErrorAction,
    type ErrorDescription,
    errorCode,
    errorMessage,
  } from '$lib/editor/error-description';

  /**
   * Opens a project from a link: `/load?path=<folder>` (local editors, `nf editor <folder>`) or
   * `/load?gatewayId=<project>` (hosted editors, "Open in editor" on the NanoForge website).
   */
  const editor = getEditor();
  let error = $state<ErrorDescription>();
  let attempt = $state(0);

  const back: ErrorAction = { label: 'Back to projects', run: () => goto('/') };
  const retry: ErrorAction = {
    label: 'Try again',
    run: () => {
      error = undefined;
      attempt++;
    },
  };

  const target = (): ProjectRef | undefined => {
    const path = page.url.searchParams.get('path')?.trim();
    const gatewayId = page.url.searchParams.get('gatewayId')?.trim();
    if (gatewayId) return { gatewayId };
    if (path) return { path };
    return undefined;
  };

  const describe = (reason: unknown, ref: ProjectRef): ErrorDescription => {
    const detail = errorMessage(reason);
    const name = 'path' in ref ? ref.path : 'this project';
    switch (errorCode(reason)) {
      case 'NOT_FOUND':
        return 'path' in ref
          ? {
              title: `No project folder at ${name}`,
              hint: 'Check the path, or pick the project from the project list.',
              detail,
              actions: [{ ...back, primary: true }],
            }
          : {
              title: "This project doesn't exist or isn't shared with you",
              hint: 'Open it from your projects on the NanoForge website.',
              detail,
              actions: [{ ...back, primary: true }],
            };
      case 'FORBIDDEN':
        return {
          title: `Can't open ${name} here`,
          hint:
            'path' in ref
              ? 'The folder is outside of the folder the editor was started in. Run nf editor from a parent folder of the project.'
              : 'Hosted projects need the online editor.',
          detail,
          actions: [{ ...back, primary: true }],
        };
      case 'UNAUTHORIZED':
        return {
          title: 'Sign in to open this project',
          hint: 'Sign in on NanoForge, then come back to this page.',
          detail,
          actions: [
            ...(editor.session.loginUrl
              ? [
                  {
                    label: 'Sign in',
                    primary: true,
                    run: () => void (location.href = editor.session.loginUrl!),
                  },
                ]
              : []),
            retry,
          ],
        };
      default:
        return {
          title: `${name === 'this project' ? 'The project' : name} could not be opened`,
          hint: 'Try again, or go back to the project list.',
          detail,
          actions: [{ ...retry, primary: true }, back],
        };
    }
  };

  $effect(() => {
    void attempt;
    const ref = target();
    if (!ref) {
      void goto('/', { replaceState: true });
      return;
    }
    let disposed = false;
    editor.projects
      .open(ref)
      .then(({ id }) => {
        if (!disposed) void goto(`/project/${id}`, { replaceState: true });
      })
      .catch((reason: unknown) => {
        if (!disposed) error = describe(reason, ref);
      });
    return () => {
      disposed = true;
    };
  });
</script>

{#if error}
  <Loading {error} />
{:else}
  <Loading
    step="Opening project"
    description="Finding the project and reading its configuration."
    progress={0.1}
  />
{/if}
