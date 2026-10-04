<script lang="ts">
  import { Button, EmptyState, Input, Menu, type MenuEntry } from '@nanoforge-dev/editor-sdk/ui';

  import { SCOPE_LABEL, compactCount, marketAction } from '../../../marketplace/marketplace';
  import type { PluginsPageState } from './plugins-page-state.svelte';

  const { page }: { page: PluginsPageState } = $props();

  const installMenu = (name: string): MenuEntry[] => [
    {
      kind: 'item',
      id: 'user',
      label: 'For me (every project)',
      onSelect: () => void page.install(name, 'user'),
    },
    {
      kind: 'item',
      id: 'project',
      label: 'For this project',
      onSelect: () => void page.install(name, 'project'),
    },
  ];
  const date = (iso: string) => (iso ? new Date(iso).toLocaleDateString() : '');
</script>

{#snippet marketButton(name: string, compatible: string | undefined)}
  {@const copy = page.copyOf(name)}
  {@const action = marketAction(copy, compatible)}
  {#if page.busy === name}
    <Button size="sm" disabled>Working…</Button>
  {:else if action === 'install' && page.project}
    <Menu items={installMenu(name)} align="end">
      {#snippet trigger({ props: triggerProps })}
        <Button {...triggerProps} size="sm" variant="primary" aria-label={`Install ${name}`}
          >Install</Button
        >
      {/snippet}
    </Menu>
  {:else if action === 'install'}
    <Button
      size="sm"
      variant="primary"
      aria-label={`Install ${name}`}
      onclick={() => void page.install(name, 'user')}>Install</Button
    >
  {:else if action === 'update' && copy?.scope}
    <Button
      size="sm"
      variant="primary"
      aria-label={`Update ${name} to ${compatible}`}
      onclick={() => void page.install(name, copy.scope!)}>Update to {compatible}</Button
    >
  {:else if action === 'installed'}
    <span class="state">Installed</span>
  {:else if action === 'builtin'}
    <span class="state">{copy?.version ? 'Part of this editor' : ''}</span>
  {:else}
    <span class="state" title="No version of this plugin runs on this editor"
      >Needs another editor</span
    >
  {/if}
{/snippet}

<div class="market">
  <div class="results">
    <Input bind:value={page.query} placeholder="Search plugins" aria-label="Search plugins" />
    {#if page.unavailable}
      <EmptyState icon="plug" title="Marketplace not available" description={page.unavailable}>
        {#snippet actions()}
          <Button size="sm" onclick={() => void page.search(page.query)}>Try again</Button>
        {/snippet}
      </EmptyState>
    {:else if !page.results.length}
      <EmptyState
        icon="plug"
        title={page.searching
          ? 'Searching…'
          : page.query.trim()
            ? 'No plugin matches'
            : 'No plugins yet'}
      />
    {:else}
      <ul aria-label="Marketplace plugins">
        {#each page.results as item (item.name)}
          <li class:selected={item.name === page.selected}>
            <button
              type="button"
              class="pick"
              aria-current={item.name === page.selected}
              onclick={() => (page.selected = item.name)}
            >
              <span class="name">{item.name}</span>
              <span class="meta">
                {item.version}{item.author ? ` · ${item.author}` : ''} ·
                {compactCount(item.downloads)} downloads
              </span>
              {#if item.description}<span class="description">{item.description}</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
      {#if page.total > page.results.length}
        <p class="hint">{page.results.length} of {page.total} shown: search to narrow.</p>
      {/if}
    {/if}
  </div>
  <div class="details" aria-label="Plugin details">
    {#if page.details && page.details.name === page.selected}
      {@const details = page.details}
      {@const copy = page.copyOf(details.name)}
      <div class="title">
        <div class="text">
          <span class="name">{details.name}</span>
          <span class="meta">
            {details.author || 'Unknown author'} · latest {details.version}
            {#if copy}
              · {copy.scope ? `${copy.version} installed ${SCOPE_LABEL[copy.scope]}` : 'built in'}
            {/if}
          </span>
        </div>
        {@render marketButton(details.name, details.compatible)}
      </div>
      {#if details.description}<p>{details.description}</p>{/if}
      {#if details.readme}<pre class="readme">{details.readme}</pre>{/if}
      <h3>Versions</h3>
      <ul class="versions" aria-label="Versions">
        {#each details.versions as version (version.version)}
          <li>
            <span>{version.version}</span>
            <span class="meta">
              {date(version.publishedAt)}{version.engines.editor
                ? ` · editor ${version.engines.editor}`
                : ''}
            </span>
          </li>
        {/each}
      </ul>
    {:else if !page.unavailable && page.results.length}
      <EmptyState icon="plug" title={page.selected ? 'Loading…' : 'Select a plugin'} />
    {/if}
  </div>
</div>

<style>
  h3 {
    margin: var(--nf-space-3) 0 var(--nf-space-1);
    font-size: inherit;
  }
  .hint {
    margin: 0 0 var(--nf-space-2);
    color: var(--nf-color-text-muted);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
  }
  .meta,
  .description,
  .state {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .state {
    white-space: nowrap;
  }
  .market {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(220px, 2fr) 3fr;
    gap: var(--nf-space-3);
    min-height: 0;
  }
  .results,
  .details {
    min-height: 0;
    overflow: auto;
  }
  .results {
    display: flex;
    flex-direction: column;
    gap: var(--nf-space-2);
  }
  .details {
    padding-left: var(--nf-space-3);
    border-left: 1px solid var(--nf-color-border);
  }
  .pick {
    display: grid;
    gap: 2px;
    width: 100%;
    padding: var(--nf-space-2);
    border: 0;
    border-radius: var(--nf-radius-control);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .pick:hover {
    background: var(--nf-color-hover);
  }
  .selected .pick {
    background: var(--nf-color-selection);
  }
  .title {
    display: flex;
    gap: var(--nf-space-3);
    align-items: center;
    justify-content: space-between;
  }
  .readme {
    margin: var(--nf-space-2) 0 0;
    font: inherit;
    white-space: pre-wrap;
  }
  .versions li {
    display: flex;
    gap: var(--nf-space-3);
    justify-content: space-between;
    padding: 2px 0;
  }
</style>
