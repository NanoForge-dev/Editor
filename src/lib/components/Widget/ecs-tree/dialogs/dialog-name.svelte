<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { InputDialog } from '$lib/components/dialogs';

  interface Props {
    open?: boolean;
    title?: string;
    nameText?: string;
    nameValue?: string;
    confirmText?: string;
    onConfirm?: (name: string) => void;
  }

  let {
    open = $bindable(false),
    title,
    nameText,
    nameValue = $bindable(''),
    confirmText,
    onConfirm,
  }: Props = $props();

  const handleEnterConfirm = (confirm: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      confirm();
    }
  };

  const handleConfirm = () => {
    const n = nameValue.trim();
    if (!n) throw 'Name is required';
    onConfirm?.(n);
  };

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
    </div>
  {/snippet}
</InputDialog>
