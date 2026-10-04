<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { CoreServices, type Disposable } from '@nanoforge-dev/editor-kernel';
  import {
    LayoutControllerToken,
    Workbench,
    type WorkbenchContext,
    WorkbenchServiceToken,
    setupWorkbench,
  } from '@nanoforge-dev/editor-ui';

  import Loading from '$lib/editor/Loading.svelte';
  import { getEditor } from '$lib/editor/editor-context';
  import {
    type ErrorAction,
    type ErrorDescription,
    errorCode,
    errorMessage,
  } from '$lib/editor/error-description';

  const editor = getEditor();
  let workbench = $state<WorkbenchContext & Disposable>();
  let error = $state<ErrorDescription>();
  let stage = $state({
    step: 'Opening project',
    description: 'Connecting to the project on the editor server.',
    progress: 0.1,
  });
  /** Bumped to retry opening the project. */
  let attempt = $state(0);

  const back: ErrorAction = { label: 'Back to projects', run: () => goto('/') };
  const retry: ErrorAction = {
    label: 'Try again',
    run: () => {
      error = undefined;
      attempt++;
    },
  };

  /** Why the project could not open, and what the user can do about it. */
  const describe = async (reason: unknown, id: string): Promise<ErrorDescription> => {
    const detail = errorMessage(reason);
    switch (errorCode(reason)) {
      case 'NOT_FOUND': {
        const recent = await editor.projects.recent().catch(() => []);
        const known = recent.find((project) => project.id === id);
        return known
          ? {
              title: `${known.name} is not open anymore`,
              hint: 'The editor server was probably restarted. Open the project again to continue.',
              detail,
              actions: [
                {
                  label: `Reopen ${known.name}`,
                  primary: true,
                  run: async () => {
                    const project = await editor.projects.open(known.ref);
                    if (project.id === id) retry.run();
                    else await goto(`/project/${project.id}`);
                  },
                },
                back,
              ],
            }
          : {
              title: 'This project is not open',
              hint: 'Open it from the project list.',
              detail,
              actions: [{ ...back, primary: true }],
            };
      }
      case 'UNAUTHORIZED':
        return {
          title: 'Your session expired',
          hint: 'Sign in again on NanoForge, then come back to this page.',
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
      case 'UNAVAILABLE':
        return {
          title: "Can't reach the editor server",
          hint: 'Check that the editor server is still running, then try again.',
          detail,
          actions: [{ ...retry, primary: true }, back],
        };
      default:
        return {
          title: 'The project could not be opened',
          hint: 'Try again, or go back to the project list.',
          detail,
          actions: [{ ...retry, primary: true }, back],
        };
    }
  };

  $effect(() => {
    const id = page.params.id!;
    void attempt;
    let disposed = false;
    let created: (WorkbenchContext & Disposable) | undefined;
    let provided: Disposable[] = [];

    const start = async () => {
      await editor.projects.load(id, (current) => {
        stage =
          current === 'model'
            ? {
                step: 'Reading the project',
                description: 'Loading the nanoforge.config files and finding the apps.',
                progress: 0.25,
              }
            : {
                step: 'Loading files',
                description: 'Listing the project files and updating the local cache.',
                progress: 0.55,
              };
      });
      stage = {
        step: 'Restoring your layout',
        description: "Reading this project's editor settings and panel layout.",
        progress: 0.85,
      };
      await new Promise<void>((resolve) => {
        const unsubscribe = editor.projectSettings.subscribe((attached) => {
          if (attached !== id) return;
          queueMicrotask(() => unsubscribe());
          resolve();
        });
      });
      if (disposed) return;
      created = setupWorkbench({
        shell: editor.shell,
        services: editor.services,
        extensions: editor.services.get(CoreServices.Extensions),
        commands: editor.services.get(CoreServices.Commands),
        contextKeys: editor.services.get(CoreServices.ContextKeys),
        settings: editor.settings,
        history: editor.history,
        logger: editor.services.get(CoreServices.Logger).getLogger('workbench'),
        activate: (event) => editor.plugins.activateByEvent(event),
      });
      provided = [
        editor.services.provide(LayoutControllerToken, created.layout),
        editor.services.provide(WorkbenchServiceToken, created.workbench),
      ];
      workbench = created;
    };
    start().catch(async (reason: unknown) => {
      const description = await describe(reason, id);
      if (!disposed) error = description;
    });
    return () => {
      disposed = true;
      for (const registration of provided) registration.dispose();
      created?.dispose();
      workbench = undefined;
    };
  });
</script>

{#if workbench}
  <Workbench context={workbench}>
    {#snippet brand()}
      <a
        class="brand"
        href="/"
        onclick={(event) => {
          event.preventDefault();
          void goto('/');
        }}>NanoForge</a
      >
    {/snippet}
  </Workbench>
{:else if error}
  <Loading {error} />
{:else}
  <Loading step={stage.step} description={stage.description} progress={stage.progress} />
{/if}

<style>
  .brand {
    margin-right: var(--nf-space-2);
    color: var(--nf-color-text);
    font-weight: 600;
    text-decoration: none;
  }
</style>
