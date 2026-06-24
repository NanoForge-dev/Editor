<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from '$lib/components/ui/dialog';
  import { Spinner } from '$lib/components/ui/spinner';

  interface Props {
    open?: boolean;
    loading?: boolean;
    archiveId?: string | null;
  }

  let { open = $bindable(false), loading = false, archiveId = null }: Props = $props();

  const EXPIRY_MS = 15 * 60 * 1000;

  let expired = $state(false);

  const downloadHref = $derived(archiveId && !expired ? `/fs/archive/${archiveId}` : null);

  $effect(() => {
    if (!archiveId) return;

    expired = false;
    const timer = setTimeout(() => (expired = true), EXPIRY_MS);
    return () => clearTimeout(timer);
  });
</script>

<Dialog bind:open>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Export project</DialogTitle>
      <DialogDescription>
        {#if loading}
          Building the project archive…
        {:else if expired}
          This archive link has expired.
        {:else}
          Your archive is ready to download.
        {/if}
      </DialogDescription>
    </DialogHeader>

    <div class="flex flex-col items-center justify-center gap-3 py-8">
      {#if loading}
        <Spinner class="size-8 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">Preparing your archive…</p>
      {:else if expired}
        <span class="i-solar-close-circle-bold-duotone size-10 text-red-400"></span>
        <p class="text-sm text-muted-foreground text-center">
          This link is no longer available. Please export the project again.
        </p>
      {:else if downloadHref}
        <span class="i-solar-check-circle-bold-duotone size-10 text-green-500"></span>
        <a href={downloadHref} download>
          <Button>
            <span class="i-ic-baseline-download size-4"></span>
            Download archive
          </Button>
        </a>
        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="i-solar-clock-circle-bold-duotone size-3.5"></span>
          This link expires after 15 minutes.
        </p>
      {/if}
    </div>

    <DialogFooter>
      <Button variant="ghost" onclick={() => (open = false)}>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
