<script lang="ts">
  import { untrack } from 'svelte';

  import {
    type PluginHost,
    ProjectServiceToken,
    REQUIRED_PLUGINS,
    RpcClientToken,
    type ServiceAccessor,
    type SettingDefinition,
    SettingsServiceToken,
    type WritableScope,
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
    /** Opens on the marketplace with this search (Get more themes: `keywords:theme`). */
    query?: string | undefined;
  }

  const { services, host, draft, definition, revision, onreload, query }: Props = $props();
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

  /** The disabled list of one scope only: the shown list merges every scope. */
  const listIn = (scope: WritableScope) =>
    (draft.scopeValue(definition, scope) as string[] | undefined) ?? [];
  /**
   * Disabling adds the plugin to the target scope's list. Enabling removes it from every scope
   * that lists it: writing the merged list into one scope would leave it disabled by another, and
   * copy personal entries into a project's committed settings.
   */
  const toggle = (name: string, enabled: boolean) => {
    if (!enabled) {
      const scope = draft.scopeOf(definition);
      const list = listIn(scope);
      if (!list.includes(name)) draft.setIn(definition, [...list, name].sort(), scope);
      return;
    }
    for (const scope of definition.scopes) {
      const list = listIn(scope);
      if (list.includes(name))
        draft.setIn(
          definition,
          list.filter((entry) => entry !== name),
          scope,
        );
    }
  };

  // svelte-ignore state_referenced_locally
  let tab = $state<'marketplace' | 'installed'>(query ? 'marketplace' : 'installed');
  // svelte-ignore state_referenced_locally
  if (query) page.query = query;

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
    void page.detailsAttempt;
    page.details = undefined;
    page.detailsError = undefined;
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
    <InstalledPluginsTab
      {page}
      plugins={$plugins}
      {known}
      {disabled}
      required={REQUIRED_PLUGINS}
      ontoggle={toggle}
    />
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
