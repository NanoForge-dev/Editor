<script lang="ts">
  import { page } from '$app/state';

  import { FullPageProjectSpinner } from '$lib/components/project-loader';
  import CompleteProjectForm from './components/complete-project-form.svelte';
  import { getConfig } from '$lib/client/config';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { createQuery } from '@tanstack/svelte-query';
  import { PLErrors, PLException, ProjectLoader } from '$lib/client/project';
  import { toastError } from '@utils-client/toasts';

  const getResolvable = () => {
    if (getConfig().mode === 'offline') {
      const path = page.url.searchParams.get('path');
      if (!path) return null;
      return { path };
    } else {
      const gatewayId = page.url.searchParams.get('gatewayId');
      if (!gatewayId) return null;
      return { gatewayId };
    }
  };

  const id = page.url.searchParams.get('id');
  const resolvable: { path: string } | { gatewayId: string } | null = getResolvable();

  $effect(() => {
    if (!id && !resolvable) {
      goto(resolve('/'));
      throw new Error('No resolvable');
    }
  });

  const query = createQuery(() => ({
    queryKey: [
      'load',
      'verify',
      resolvable ? ('path' in resolvable ? resolvable.path : resolvable.gatewayId) : '',
    ],
    queryFn: async (): Promise<string | null> => {
      if (!id && !resolvable) throw new Error('No resolvable');
      if (id) {
        try {
          const project = await ProjectLoader.loadFromId(id);
          await goto(resolve(`/dashboard?id=${project.id}`));
        } catch (e) {
          if (e instanceof PLException) {
            if (e.reason === PLErrors.Empty_Project && getConfig().mode === 'online') {
              return e.args[1] as string;
            }
          }
          console.error(e);
          toastError('Failed to load project from id', (e as any).message);
        }
      }

      if (resolvable) {
        try {
          const project = await ('path' in resolvable
            ? ProjectLoader.loadFromPath(resolvable.path)
            : ProjectLoader.loadFromGatewayId(resolvable.gatewayId));
          await goto(resolve(`/dashboard?id=${project.id}`));
          return null;
        } catch (e) {
          if (e instanceof PLException) {
            if (e.reason === PLErrors.Empty_Project && getConfig().mode === 'online') {
              return e.args[1] as string;
            }
          }
          console.error(e);
          toastError('Failed to load project', (e as any).message);
        }
      }
      await goto(resolve('/'));
      return null;
    },
  }));
</script>

{#if query.isFetched && !query.isLoading && query.data}
  <div class="flex h-100vh w-full items-center justify-center">
    <CompleteProjectForm gatewayId={query.data} />
  </div>
{:else}
  <FullPageProjectSpinner />
{/if}
