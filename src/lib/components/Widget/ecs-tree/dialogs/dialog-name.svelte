<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { InputDialog } from '$lib/components/dialogs';
  import type { MaybePromise } from '@utils/types';

  interface Props {
    open?: boolean;
    title?: string;
    nameText?: string;
    nameValue?: string;
    confirmText?: string;
    onConfirm?: (name: string) => MaybePromise<void>;
    validate?: (name: string) => string | null;
  }

  let {
    open = $bindable(false),
    title,
    nameText,
    nameValue = $bindable(''),
    confirmText,
    onConfirm,
    validate,
  }: Props = $props();

  const handleEnterConfirm = (confirm: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      confirm();
    }
  };

  const handleConfirm = async () => {
    if (validate?.(nameValue.trim())) return;
    const n = nameValue.trim();
    if (!n) throw 'Name is required';
    await onConfirm?.(n);
  };

  const error = $derived(validate?.(nameValue.trim()));

  const reset = () => {
    nameValue = '';
  };
</script>

<InputDialog
  {title}
  {confirmText}
  confirmDisabled={!nameValue}
  bind:open
  onConfirm={handleConfirm}
  {reset}
>
  {#snippet children(confirm)}
    <div class="flex flex-col gap-3 py-2">
      <Input
        placeholder={nameText ?? 'Name'}
        bind:value={nameValue}
        onkeydown={handleEnterConfirm(confirm)}
      />
      {#if error}
        <span class="text-xs text-destructive">Error: {error}</span>
      {/if}
    </div>
  {/snippet}
</InputDialog>
