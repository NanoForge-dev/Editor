<script lang="ts">
  import { Button, EmptyState, Input } from '@nanoforge-dev/editor-sdk/ui';

  import type { PackagesDialogState } from './packages-dialog-state.svelte';

  const { packages }: { packages: PackagesDialogState } = $props();
</script>

<div class="market">
  <div class="results">
    <Input bind:value={packages.query} placeholder="Search packages" aria-label="Search packages" />
    {#if packages.unavailable}
      <EmptyState icon="box" title="Registry not available" description={packages.unavailable}>
        {#snippet actions()}
          <Button size="sm" onclick={() => void packages.search(packages.query)}>Try again</Button>
        {/snippet}
      </EmptyState>
    {:else if !packages.results.length}
      <EmptyState
        icon="box"
        title={packages.searching
          ? 'Searching…'
          : packages.query.trim()
            ? 'No package matches'
            : 'No packages yet'}
      />
    {:else}
      <ul aria-label="Registry packages">
        {#each packages.results as item (item.name)}
          {@const mine = packages.installedOf(item.name)}
          <li class:selected={item.name === packages.selected}>
            <button
              type="button"
              class="pick"
              aria-current={item.name === packages.selected}
              onclick={() => (packages.selected = item.name)}
            >
              <span class="name">{item.name}</span>
              <span class="meta">
                {item.version}{item.author ? ` · ${item.author}` : ''}{mine
                  ? ` · ${mine.version} installed`
                  : ''}
              </span>
              {#if item.description}<span class="description">{item.description}</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
      {#if packages.total > packages.results.length}
        <p class="hint">{packages.results.length} of {packages.total} shown: search to narrow.</p>
      {/if}
    {/if}
  </div>
  <div class="details" aria-label="Package details">
    {#if packages.details && packages.details.name === packages.selected}
      {@const details = packages.details}
      {@const mine = packages.installedOf(details.name)}
      {@const dependencies = Object.entries(details.versions[0]?.dependencies ?? {})}
      <div class="title">
        <div class="text">
          <span class="name">{details.name}</span>
          <span class="meta">
            {details.author || 'Unknown author'} · latest {details.version}
          </span>
        </div>
        {#if packages.busy === details.name}
          <Button size="sm" disabled>Working…</Button>
        {:else if mine}
          <span class="state">{mine.version} installed</span>
        {:else}
          <Button
            size="sm"
            variant="primary"
            disabled={!!packages.busy || !!packages.readOnly || !packages.project}
            aria-label={`Install ${details.name}`}
            onclick={() => void packages.install(details.name)}>Install</Button
          >
        {/if}
      </div>
      {#if details.description}<p>{details.description}</p>{/if}
      <h3>Depends on</h3>
      {#if dependencies.length}
        <ul class="plain" aria-label="Dependencies">
          {#each dependencies as [name, range] (name)}
            <li><span>{name}</span> <span class="meta">{range}</span></li>
          {/each}
        </ul>
        <p class="hint">Installed next to it in nf_modules.</p>
      {:else}
        <p class="hint">No other package.</p>
      {/if}
      {#if details.readme}<pre class="readme">{details.readme}</pre>{/if}
    {:else if !packages.unavailable && packages.results.length}
      <EmptyState icon="box" title={packages.selected ? 'Loading…' : 'Select a package'} />
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
    font-size: var(--nf-font-size-sm);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .market {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(240px, 2fr) 3fr;
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
  .plain li {
    padding: 2px 0;
  }
  .readme {
    margin: var(--nf-space-3) 0 0;
    font: inherit;
    white-space: pre-wrap;
  }
</style>
