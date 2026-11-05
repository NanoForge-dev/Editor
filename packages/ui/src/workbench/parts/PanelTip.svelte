<script lang="ts">
  import { CoreSettings } from '@nanoforge-dev/editor-settings';

  import Button from '../../components/button.svelte';
  import Icon from '../../components/icon.svelte';
  import { docsPage } from '../tip/docs-url.const';
  import { getWorkbenchContext } from '../workbench-context';

  /** A panel's first-time tip, above it until put away (`tips.dismissed`, account scope). */
  const { id, tip }: { id: string; tip: { text: string; docs?: string | undefined } } = $props();

  const { settings } = getWorkbenchContext();
  const dismissed = settings.observe(CoreSettings.tipsDismissed);

  const dismiss = () =>
    void settings
      .set(
        CoreSettings.tipsDismissed,
        [...new Set([...settings.get(CoreSettings.tipsDismissed), id])],
        settings.hasStore('account') ? 'account' : 'machine',
      )
      .catch(() => undefined);
</script>

{#if !$dismissed.includes(id)}
  <aside class="tip" aria-label="Tip">
    <Icon name="info" size={14} />
    <p>
      {tip.text}
      {#if tip.docs}
        <a href={docsPage(tip.docs)} target="_blank" rel="noopener">Learn more</a>
      {/if}
    </p>
    <Button size="sm" variant="ghost" onclick={dismiss}>Got it</Button>
  </aside>
{/if}

<style>
  .tip {
    display: flex;
    flex: none;
    gap: var(--nf-space-2);
    align-items: flex-start;
    padding: var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
    background: color-mix(in srgb, var(--nf-color-accent) 10%, var(--nf-color-surface));
    font-size: var(--nf-font-size-sm);
  }
  .tip :global(svg) {
    flex: none;
    margin-top: 2px;
    color: var(--nf-color-accent);
  }
  p {
    flex: 1;
    margin: 0;
  }
  a {
    color: var(--nf-color-accent);
  }
</style>
