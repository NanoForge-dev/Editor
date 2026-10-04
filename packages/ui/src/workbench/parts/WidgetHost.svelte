<script lang="ts">
  import type { WidgetRef } from '@nanoforge-dev/editor-layout';

  import Button from '../../components/button.svelte';
  import EmptyState from '../../components/empty-state.svelte';
  import { getWorkbenchContext } from '../workbench-context';

  interface Props {
    ref: WidgetRef;
    active: boolean;
    onclose?: () => void;
  }

  const { ref, active, onclose }: Props = $props();
  const { workbench } = getWorkbenchContext();

  const status = $derived(workbench.view(ref.widgetId));
  const instance = $derived(workbench.instance(ref));

  $effect(() => {
    const current = $status;
    if (current.kind !== 'ready') return;
    const styles = workbench.useStyles(current.view, current.owner);
    return () => styles.dispose();
  });

  const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));
</script>

<div
  class="widget"
  data-nf-widget={ref.widgetId}
  data-nf-instance={ref.instanceId}
  data-nf-history={$status.kind === 'ready' ? $status.descriptor.historyContext : undefined}
  hidden={!active}
>
  {#if $status.kind === 'ready'}
    {@const view = $status.view}
    <svelte:boundary>
      {#if view.component}
        <view.component {instance} />
      {:else if view.mount}
        {@const mount = view.mount}
        <div
          class="mount"
          {@attach (element) => {
            const mounted = mount(element, instance);
            return () => mounted.dispose();
          }}
        ></div>
      {/if}
      {#snippet failed(error, reset)}
        <EmptyState
          icon="circle-alert"
          title="This panel stopped working"
          description={describe(error)}
        >
          {#snippet actions()}
            <Button onclick={reset}>Reload panel</Button>
          {/snippet}
        </EmptyState>
      {/snippet}
    </svelte:boundary>
  {:else if $status.kind === 'loading'}
    <EmptyState title="Loading {$status.descriptor.title}…" />
  {:else if $status.kind === 'unavailable'}
    <EmptyState
      icon="triangle-alert"
      title="{$status.descriptor.title} is unavailable"
      description={$status.reason}
    />
  {:else}
    <EmptyState
      icon="plug"
      title="Panel not available"
      description="It comes from a plugin that is not installed or is disabled ({ref.widgetId})."
    >
      {#snippet actions()}
        {#if onclose}<Button onclick={onclose}>Close panel</Button>{/if}
      {/snippet}
    </EmptyState>
  {/if}
</div>

<style>
  .widget {
    position: absolute;
    inset: 0;
    overflow: auto;
  }
  .mount {
    height: 100%;
  }
</style>
