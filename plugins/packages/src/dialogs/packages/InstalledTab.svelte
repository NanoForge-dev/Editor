<script lang="ts">
  import { Button, EmptyState } from '@nanoforge-dev/editor-sdk/ui';

  import { reasonOf, updateChoices } from '../../model/installed-package';
  import type { PackagesDialogState } from './packages-dialog-state.svelte';

  interface Props {
    packages: PackagesDialogState;
    /** Shows the Browse tab. */
    onbrowse: () => void;
  }

  const { packages, onbrowse }: Props = $props();
</script>

<div class="installed">
  {#if !packages.installed.length}
    <EmptyState
      icon="box"
      title="No packages in this project"
      description="Packages bring components, systems and assets, read-only in nf_modules."
    >
      {#snippet actions()}
        <Button size="sm" onclick={onbrowse}>Browse packages</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <ul aria-label="Installed packages">
      {#each packages.installed as entry (entry.name)}
        <li class="row">
          <div class="text">
            <span class="name">{entry.name}</span>
            <span class="meta">
              {entry.version} · {reasonOf(entry)}{entry.latest
                ? ` · latest ${entry.latest}`
                : ''}{entry.present ? '' : ' · not in nf_modules'}
            </span>
          </div>
          {#if packages.busy === entry.name}
            <Button size="sm" disabled>Working…</Button>
          {:else}
            {#each updateChoices(entry) as choice (choice.version)}
              <Button
                size="sm"
                variant={choice.latest ? 'secondary' : 'primary'}
                disabled={!!packages.busy}
                aria-label={`Update ${entry.name} to ${choice.version}`}
                onclick={() => void packages.update(entry.name, choice.latest)}
                >{choice.label}</Button
              >
            {/each}
            <Button
              size="sm"
              disabled={!!packages.busy || entry.dependents.length > 0}
              title={entry.dependents.length
                ? `Needed by ${entry.dependents.join(', ')}`
                : undefined}
              aria-label={`Uninstall ${entry.name}`}
              onclick={() => void packages.uninstall(entry.name)}>Uninstall</Button
            >
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .installed {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .row {
    display: flex;
    gap: var(--nf-space-3);
    align-items: center;
    padding: var(--nf-space-2) 0;
    border-bottom: 1px solid var(--nf-color-border);
  }
  .text {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
  }
  .meta {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
</style>
