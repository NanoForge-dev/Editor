<script lang="ts">
  import type { Snippet } from 'svelte';
  import BaseDialog from './base-dialog.svelte';
  import type { MaybePromise } from '@utils/types';

  interface Props {
    open?: boolean;
    title?: string;
    description?: string;
    children?: Snippet<[confirm: () => void, cancel: () => void]>;
    confirmText?: string;
    cancelText?: string;
    confirmDisabled?: boolean;
    onOpenChange?: (open: boolean) => void;
    reset?: () => void;
    onConfirm?: (...args: any[]) => MaybePromise<void>;
  }

  let { open = $bindable(false), onOpenChange, reset, ...props }: Props = $props();

  const handleOpenChange = (open: boolean) => {
    reset?.();
    onOpenChange?.(open);
  };
</script>

<BaseDialog {...props} bind:open onOpenChange={handleOpenChange} />
