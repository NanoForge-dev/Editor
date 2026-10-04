<script lang="ts">
  import { Button, Dialog } from '@nanoforge-dev/editor-sdk/ui';

  import type { Confirmation } from './confirmation.type';

  let { request = $bindable() }: { request: Confirmation | undefined } = $props();
</script>

<Dialog
  open={request !== undefined}
  title={request?.title ?? ''}
  description={request?.description}
  onclose={() => (request = undefined)}
>
  {#snippet footer()}
    <Button onclick={() => (request = undefined)}>Cancel</Button>
    <Button
      variant="danger"
      onclick={() => {
        const action = request?.run;
        request = undefined;
        action?.();
      }}>{request?.confirm ?? 'Confirm'}</Button
    >
  {/snippet}
</Dialog>
