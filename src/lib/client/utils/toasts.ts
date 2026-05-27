import { toast } from 'svelte-sonner';

export const toastError = (message: string, description?: string) =>
  toast.error(message, {
    description,
    position: 'top-right',
    style: 'background: oklch(var(--destructive)); color: oklch(var(--destructive-foreground));',
  });
