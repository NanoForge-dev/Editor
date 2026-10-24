<script lang="ts">
  import type { NotificationService } from '../workbench/notification/notification-service';
  import Button from './button.svelte';
  import Icon from './icon.svelte';
  import IconButton from './icon-button.svelte';

  const { notifications }: { notifications: NotificationService } = $props();
  const active = $derived(notifications.active);
  const ICONS = {
    info: 'info',
    success: 'circle-check',
    warning: 'triangle-alert',
    error: 'circle-alert',
  } as const;
</script>

<section class="toasts" aria-live="polite" aria-label="Notifications">
  {#each $active as notification (notification.id)}
    <div
      class="toast {notification.severity}"
      role={notification.severity === 'error' ? 'alert' : 'status'}
    >
      <span class="icon"><Icon name={ICONS[notification.severity]} /></span>
      <div class="body">
        <p class="message">{notification.message}</p>
        {#if notification.detail}<p class="detail">{notification.detail}</p>{/if}
        {#if notification.actions.length}
          <div class="actions">
            {#each notification.actions as action (action.title)}
              <Button
                size="sm"
                onclick={async () => {
                  await action.run();
                  notifications.dismiss(notification.id);
                }}>{action.title}</Button
              >
            {/each}
          </div>
        {/if}
      </div>
      <IconButton
        icon="x"
        label="Dismiss"
        size={14}
        onclick={() => notifications.dismiss(notification.id)}
      />
    </div>
  {/each}
</section>

<style>
  .toasts {
    position: fixed;
    right: var(--nf-space-3);
    bottom: 32px;
    z-index: var(--nf-z-toast);
    display: grid;
    gap: var(--nf-space-2);
    width: min(380px, calc(100vw - 24px));
  }
  .toast {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--nf-space-2);
    align-items: start;
    padding: var(--nf-space-2) var(--nf-space-2) var(--nf-space-2) var(--nf-space-3);
    border: 1px solid var(--nf-color-border);
    border-left: 3px solid var(--nf-color-focus);
    border-radius: var(--nf-radius-float);
    background: var(--nf-color-raised);
    box-shadow: var(--nf-shadow-float);
  }
  .success {
    border-left-color: var(--nf-color-success);
  }
  .warning {
    border-left-color: var(--nf-color-warning);
  }
  .error {
    border-left-color: var(--nf-color-danger);
  }
  .icon {
    padding-top: 3px;
  }
  .error .icon {
    color: var(--nf-color-danger);
  }
  .warning .icon {
    color: var(--nf-color-warning);
  }
  .success .icon {
    color: var(--nf-color-success);
  }
  .message {
    margin: 2px 0 0;
  }
  .detail {
    margin: 2px 0 0;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .actions {
    display: flex;
    gap: var(--nf-space-1);
    margin-top: var(--nf-space-2);
  }
</style>
