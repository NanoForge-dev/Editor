<script lang="ts">
  import type { ServiceAccessor } from '@nanoforge-dev/editor-kernel';
  import type { ProjectSuggestion } from '@nanoforge-dev/editor-project';
  import { Button } from '@nanoforge-dev/editor-ui';

  import { AdoptionServiceToken } from '../adoption/adoption-service';

  /**
   * "Adapt to the editor": what the editor can't edit well in this project, one card each, with
   * a fix previewed before it is applied (or an action), and Dismiss.
   */
  const { services }: { services: ServiceAccessor } = $props();
  // svelte-ignore state_referenced_locally
  const adoption = services.tryGet(AdoptionServiceToken);
  const report = adoption?.report;
  let busy = $state<string>();
  /** Collapsed until asked: the Project screen is the first one people see. */
  let expanded = $state(false);

  const run = async (suggestion: ProjectSuggestion, task: () => unknown) => {
    busy = suggestion.id;
    try {
      await task();
    } finally {
      busy = undefined;
    }
  };
</script>

{#if adoption && $report?.suggestions.length}
  <section class="report" aria-labelledby="adoption-title">
    <header>
      <h2 id="adoption-title">Adapt to the editor</h2>
      <p class="muted">
        {$report.suggestions.length}
        {$report.suggestions.length === 1 ? 'part' : 'parts'} of this project the editor can't edit well
        yet. Each change is shown before it is made, and undone in one step.
      </p>
      <Button size="sm" aria-expanded={expanded} onclick={() => (expanded = !expanded)}
        >{expanded ? 'Hide suggestions' : 'Show suggestions'}</Button
      >
    </header>
    {#if expanded}
      <ul class="cards">
        {#each $report.suggestions as suggestion (suggestion.id)}
          <li class="card" aria-label={suggestion.title}>
            <div class="title">
              <h3>{suggestion.title}</h3>
              {#if suggestion.app}<span class="app">{suggestion.app}</span>{/if}
            </div>
            <p>{suggestion.detail}</p>
            <div class="buttons">
              {#if suggestion.fix}
                {@const fix = suggestion.fix}
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!!busy}
                  onclick={() => run(suggestion, () => adoption.fix(suggestion))}
                  >{fix.title}…</Button
                >
              {:else if suggestion.action}
                {@const action = suggestion.action}
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!!busy}
                  onclick={() => run(suggestion, () => action.run())}>{action.title}</Button
                >
              {/if}
              <Button
                size="sm"
                variant="ghost"
                disabled={!!busy}
                onclick={() => run(suggestion, () => adoption.dismiss(suggestion))}>Dismiss</Button
              >
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .report {
    display: grid;
    gap: var(--nf-space-2);
  }
  h2 {
    margin: 0;
  }
  .muted {
    margin: 0;
    color: var(--nf-color-text-muted);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--nf-space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .card {
    display: grid;
    gap: var(--nf-space-2);
    align-content: start;
    padding: var(--nf-space-3);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-float);
    background: var(--nf-color-surface);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nf-space-2) var(--nf-space-3);
    align-items: center;
  }
  header .muted {
    flex: 1;
    min-width: 240px;
  }
  .title {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nf-space-2);
    align-items: baseline;
  }
  h3 {
    margin: 0;
    font-size: var(--nf-font-size-md, 13px);
  }
  .app {
    color: var(--nf-color-accent);
    font-size: var(--nf-font-size-sm);
    font-weight: normal;
  }
  p {
    margin: 0;
  }
  .buttons {
    display: flex;
    gap: var(--nf-space-2);
  }
</style>
