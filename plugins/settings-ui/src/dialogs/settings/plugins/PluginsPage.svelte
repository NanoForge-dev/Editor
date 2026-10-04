<script lang="ts">
  import { untrack } from 'svelte';

  import {
    type PluginHost,
    ProjectServiceToken,
    RpcClientToken,
    type ServiceAccessor,
    type SettingDefinition,
    SettingsServiceToken,
  } from '@nanoforge-dev/editor-sdk';
  import { Button, Tabs } from '@nanoforge-dev/editor-sdk/ui';

  import type { SettingsDraft } from '../../../settings/settings-draft';
  import InstalledPluginsTab from './InstalledPluginsTab.svelte';
  import MarketplaceTab from './MarketplaceTab.svelte';
  import { PluginsPageState, registryApi } from './plugins-page-state.svelte';

  interface Props {
    services: ServiceAccessor;
    host: PluginHost;
    draft: SettingsDraft;
    /** `plugins.disabled`. */
    definition: SettingDefinition;
    revision: number;
    onreload: () => void;
  }

  const { services, host, draft, definition, revision, onreload }: Props = $props();
  // svelte-ignore state_referenced_locally
  const plugins = host.plugins;

  const known = $derived(
    $plugins.map((plugin) => ({
      name: plugin.name,
      version: plugin.descriptor.manifest.version,
      source: plugin.descriptor.source,
    })),
  );
  // svelte-ignore state_referenced_locally
  const page = new PluginsPageState(
    registryApi(services.get(RpcClientToken)),
    services.get(ProjectServiceToken).current.get()?.id,
    services.get(SettingsServiceToken),
    () => known,
  );

  const disabled = $derived.by(() => {
    void revision;
    return new Set(draft.valueOf(definition) as string[]);
  });
  const changed = $derived.by(() => {
    void revision;
    return draft.changes.get().has(definition.key);
  });

  const toggle = (name: string, enabled: boolean) => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a plain copy, not state
    const next = new Set(disabled);
    if (enabled) next.delete(name);
    else next.add(name);
    draft.set(definition, [...next].sort());
  };

  let tab = $state<'marketplace' | 'installed'>('installed');

  $effect(() => {
    if (tab !== 'marketplace') return;
    const text = page.query;
    const timer = setTimeout(
      () => void page.search(text),
      untrack(() => page.results.length) ? 200 : 0,
    );
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const name = page.selected;
    page.details = undefined;
    if (!name) return;
    return page.loadDetails(name);
  });

  $effect(() => {
    if (tab === 'installed') untrack(() => page.lookUpNewest(known));
  });
</script>

<section class="page" aria-label="Plugins">
  <header>
    <h2>Plugins</h2>
    <Tabs
      label="Plugins"
      items={[
        { id: 'marketplace', label: 'Marketplace' },
        { id: 'installed', label: 'Installed' },
      ]}
      active={tab}
      onchange={(id) => (tab = id as typeof tab)}
    />
  </header>
  {#if changed || page.pending.size}
    <p class="reload" role="status">
      {page.pending.size
        ? 'Plugins were installed or removed: reload the editor to finish.'
        : 'Apply your changes, then reload.'}
      <Button size="sm" variant="primary" onclick={onreload}
        >{page.pending.size && !changed ? 'Reload now' : 'Apply and reload'}</Button
      >
    </p>
  {/if}
  {#if page.failure}
    <p class="failure" role="alert">{page.failure}</p>
  {/if}

  {#if tab === 'marketplace'}
    <MarketplaceTab {page} />
  {:else}
    <InstalledPluginsTab {page} plugins={$plugins} {known} {disabled} ontoggle={toggle} />
  {/if}
</section>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding: var(--nf-space-3) var(--nf-space-4);
    box-sizing: border-box;
  }
  header {
    display: flex;
    gap: var(--nf-space-4);
    align-items: center;
    margin-bottom: var(--nf-space-2);
  }
  h2 {
    margin: 0;
    font-size: var(--nf-font-size-lg);
  }
  .reload {
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
