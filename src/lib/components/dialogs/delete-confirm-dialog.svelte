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

  type Props = {
    open?: boolean;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    onOpenChange?: (open: boolean) => void;
    onConfirm?: () => void;
  } & ({ type: string } | { title: string }) &
    ({ name: string } | { children: Snippet });

  let {
    open = $bindable(false),
    description,
    confirmText,
    cancelText,
    onOpenChange,
    onConfirm,
    ...props
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
    <DialogHeader>
      {#if 'title' in props}
        <DialogTitle>{props.title}</DialogTitle>
      {:else}
        <DialogTitle>Deleting {props.type}</DialogTitle>
      {/if}
      {#if description}
        <DialogDescription>{description}</DialogDescription>
      {/if}
    </DialogHeader>

    {#if 'children' in props}
      {@render props.children()}
    {:else}
      <div class="py-6 px-2 text-base">
        Are you sure you want to delete <strong class="bold">{props.name}</strong> ?
      </div>
    {/if}

    <DialogFooter>
      <Button variant="ghost" onclick={cancel}>{cancelText ?? 'Cancel'}</Button>
      <Button variant="destructive" onclick={confirm}>{confirmText ?? 'Delete'}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
