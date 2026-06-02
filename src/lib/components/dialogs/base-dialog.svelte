<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
  } from '$lib/components/ui/dialog';
  import type { Snippet } from 'svelte';

  interface Props {
    open?: boolean;
    title?: string;
    description?: string;
    children?: Snippet<[confirm: () => void, cancel: () => void]>;
    confirmText?: string;
    cancelText?: string;
    confirmDisabled?: boolean;
    onOpenChange?: (open: boolean) => void;
    onConfirm?: (...args: any[]) => void;
  }

  let {
    open = $bindable(false),
    title,
    description,
    children,
    confirmText,
    cancelText,
    confirmDisabled,
    onOpenChange,
    onConfirm,
  }: Props = $props();

  const confirm = () => {
    onConfirm?.();
    open = false;
    onOpenChange?.(false);
  };

  const cancel = () => {
    open = false;
    onOpenChange?.(false);
  };
</script>

<Dialog bind:open>
  <DialogContent class="sm:max-w-md">
    {#if title || description}
      <DialogHeader>
        {#if title}
          <DialogTitle>{title}</DialogTitle>
        {/if}
        {#if description}
          <DialogDescription>{description}</DialogDescription>
        {/if}
      </DialogHeader>
    {/if}
    {@render children?.(confirm, cancel)}
    <DialogFooter>
      <Button variant="ghost" onclick={cancel}>{cancelText ?? 'Cancel'}</Button>
      <Button disabled={confirmDisabled} onclick={confirm}>{confirmText ?? 'Confirm'}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
