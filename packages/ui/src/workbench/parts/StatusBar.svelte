<script lang="ts">
  import { Popover } from 'bits-ui';

  import Button from '../../components/button.svelte';
  import Icon from '../../components/icon.svelte';
  import {
    STATUS_BAR_ITEMS,
    type StatusBarItem,
  } from '../extension-point/status-bar.extension-point';
  import { getWorkbenchContext } from '../workbench-context';
  import StatusText from './StatusText.svelte';

  const context = getWorkbenchContext();
  const items = context.extensions.observe(STATUS_BAR_ITEMS);
  const history = context.notifications.history;

  /** Bumped when context keys change, so `when` clauses are re-evaluated. */
  let keys = $state(0);
  $effect(() => {
    const subscription = context.contextKeys.onDidChange(() => keys++);
    return () => subscription.dispose();
  });

  const side = (list: readonly { value: StatusBarItem }[], alignment: 'left' | 'right') =>
    list
      .map((contribution) => contribution.value)
      .filter((item) => item.alignment === alignment && context.contextKeys.evaluate(item.when))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const left = $derived.by(() => {
    void keys;
    return side($items, 'left');
  });
  const right = $derived.by(() => {
    void keys;
    return side($items, 'right');
  });

  const run = (item: StatusBarItem) =>
    item.command &&
    context.commands
      .execute(item.command)
      .catch((error: unknown) => context.logger.error(`${item.command} failed`, error));

  const time = (value: number) =>
    new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
</script>

<footer class="status">
  <div class="side">
    {#each left as item (item.id)}
      <StatusText {item} onclick={() => run(item)} />
    {/each}
  </div>
  <div class="side">
    {#each right as item (item.id)}
      <StatusText {item} onclick={() => run(item)} />
    {/each}
    <Popover.Root>
      <Popover.Trigger class="status-button" aria-label="Notifications ({$history.length})">
        <Icon name="info" size={13} />
        {#if $history.length}<span>{$history.length}</span>{/if}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          class="nf-popover notification-center"
          side="top"
          align="end"
          sideOffset={6}
        >
          <header>
            <strong>Notifications</strong>
            <Button
              size="sm"
              variant="ghost"
              disabled={!$history.length}
              onclick={() => context.notifications.clearHistory()}>Clear</Button
            >
          </header>
          {#each $history as notification (notification.id)}
            <p class="entry {notification.severity}">
              <time>{time(notification.time)}</time>
              {notification.message}
            </p>
          {:else}
            <p class="none">No notifications</p>
          {/each}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </div>
</footer>

<style>
  .status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 24px;
    padding: 0 var(--nf-space-2);
    border-top: 1px solid var(--nf-color-border);
    background: var(--nf-color-bg);
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .side {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 100%;
  }
  :global(.status-button) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 20px;
    padding: 0 6px;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: inherit;
    font-size: inherit;
    cursor: pointer;
  }
  :global(.status-button:hover) {
    background: var(--nf-color-hover);
    color: var(--nf-color-text);
  }
  :global(.notification-center) {
    width: 360px;
  }
  :global(.notification-center header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 4px 6px;
  }
  :global(.notification-center .entry) {
    margin: 0;
    padding: 6px 4px;
    border-top: 1px solid var(--nf-color-border);
  }
  :global(.notification-center .error) {
    color: var(--nf-color-danger);
  }
  :global(.notification-center time) {
    margin-right: 6px;
    color: var(--nf-color-text-faint);
  }
  :global(.notification-center .none) {
    margin: 0;
    padding: 6px 4px;
    color: var(--nf-color-text-muted);
  }
</style>
