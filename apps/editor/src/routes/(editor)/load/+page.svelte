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
   *
   * Opening a trusted local folder runs its code (`nanoforge.config.ts`, plugins, builds), and
   * any web page can link here: a folder that is not in the recent projects asks first, to trust
   * it or to open it in restricted mode (its code off). A hosted editor opens projects by their id
   * only, never by path.
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

  /**
   * Whether a folder was opened here before (the link then needs no confirmation): its real path
   * only, as recent projects keep it. A relative path always asks.
   */
  const known = async (path: string): Promise<boolean> => {
    const trimmed = path.replace(/(.)\/+$/, '$1');
    const recent = await editor.projects.recent().catch(() => []);
    return recent.some((project) => 'path' in project.ref && project.ref.path === trimmed);
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
    const open = (trust = false) =>
      editor.projects
        .open(ref)
        .then(async (project) => {
          if (trust && !project.trusted) await editor.projects.trust();
          if (!disposed) void goto(`/project/${project.id}`, { replaceState: true });
        })
        .catch((reason: unknown) => {
          if (!disposed) error = describe(reason, ref);
        });
    if (!('path' in ref)) void open();
    else if (editor.session.mode === 'ONLINE') {
      error = {
        title: 'Projects open by their id here',
        hint: 'This editor is hosted: open the project from your projects on the NanoForge website.',
        actions: [{ ...back, primary: true }],
      };
    } else {
      void known(ref.path).then((trusted) => {
        if (disposed) return;
        if (trusted) return void open();
        error = {
          title: `Open ${ref.path}?`,
          hint: 'Trusting a folder lets the editor run its code on this computer: its nanoforge.config.ts, its plugins, its builds and games. Trust it only if you trust where it comes from; otherwise open it in restricted mode, with its code off.',
          actions: [
            {
              label: 'Trust and open',
              primary: true,
              run: () => {
                error = undefined;
                void open(true);
              },
            },
            {
              label: 'Open in restricted mode',
              run: () => {
                error = undefined;
                void open();
              },
            },
            back,
          ],
        };
      });
    }
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
