<script lang="ts">
  import { untrack } from 'svelte';

  import {
    CatalogServiceToken,
    ProjectServiceToken,
    RpcClientToken,
    type ServiceAccessor,
  } from '@nanoforge-dev/editor-sdk';
  import { Button, Dialog, Tabs } from '@nanoforge-dev/editor-sdk/ui';

  import { plural } from '../../model/installed-package';
  import BrowseTab from './BrowseTab.svelte';
  import InstalledTab from './InstalledTab.svelte';
  import { PackagesDialogState, registryApi } from './packages-dialog-state.svelte';

  interface Props {
    services: ServiceAccessor;
    onclose: () => void;
    tab?: 'browse' | 'installed';
  }

  // svelte-ignore state_referenced_locally
  const { services, onclose, tab: initialTab }: Props = $props();
  // svelte-ignore state_referenced_locally
  const packages = new PackagesDialogState(
    registryApi(services.get(RpcClientToken)),
    services.get(ProjectServiceToken).current.get()?.id,
    services.tryGet(CatalogServiceToken),
  );

  let open = $state(true);
  // svelte-ignore state_referenced_locally
  let tab = $state<'browse' | 'installed'>(initialTab ?? 'browse');

  const close = () => {
    open = false;
    onclose();
  };

  void packages.loadInstalled();

  $effect(() => {
    if (tab !== 'browse') return;
    const text = packages.query;
    const timer = setTimeout(
      () => void packages.search(text),
      untrack(() => packages.results.length) ? 200 : 0,
    );
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const name = packages.selected;
    packages.details = undefined;
    if (!name) return;
    return packages.loadDetails(name);
  });
</script>

<Dialog bind:open title="Packages" width="min(960px, 94vw)" onclose={close}>
  <div class="packages">
    <div class="top">
      <Tabs
        label="Packages"
        items={[
          { id: 'browse', label: 'Browse' },
          { id: 'installed', label: `Installed (${packages.installed.length})` },
        ]}
        active={tab}
        onchange={(id) => (tab = id as typeof tab)}
      />
    </div>
    {#if !packages.project}
      <p class="note" role="status">Open a project to install packages in it.</p>
    {:else if packages.readOnly}
      <p class="note" role="status">{packages.readOnly}</p>
    {/if}
    {#if packages.absent.length}
      <p class="note" role="status">
        {plural(packages.absent.length, 'package')} of this project {packages.absent.length === 1
          ? 'is'
          : 'are'} not in nf_modules.
        <Button
          size="sm"
          variant="primary"
          disabled={!!packages.busy}
          onclick={() => void packages.restore()}>Restore packages</Button
        >
      </p>
    {/if}
    {#if packages.failure}
      <p class="failure" role="alert">{packages.failure}</p>
    {/if}

    {#if tab === 'browse'}
      <BrowseTab {packages} />
    {:else}
      <InstalledTab {packages} onbrowse={() => (tab = 'browse')} />
    {/if}
  </div>
  {#snippet footer()}
    <Button onclick={close}>Close</Button>
  {/snippet}
</Dialog>

<style>
  .packages {
    display: flex;
    flex-direction: column;
    /* The dialog is at most 70vh, with its header and footer. */
    height: min(560px, calc(70vh - 120px));
    min-height: 0;
  }
  .top {
    padding-bottom: var(--nf-space-2);
  }
  .note {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
    margin: 0 0 var(--nf-space-2);
  }
  .failure {
    margin: 0 0 var(--nf-space-2);
    color: var(--nf-color-danger);
  }
</style>
