<script lang="ts">
  import { BaseDialog } from '$lib/components/dialogs';
  import { Button } from '$lib/components/ui/button';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import type { MaybePromise } from '@utils/types';

  interface Props {
    open?: boolean;
    accept?: string;
    onConfirm: (files: File[]) => MaybePromise<void>;
  }

  let { open = $bindable(false), accept, onConfirm }: Props = $props();

  let files = $state<File[]>([]);
  let dragging = $state(false);
  let inputEl = $state<HTMLInputElement>();

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let size = bytes / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }
    return `${size.toFixed(1)} ${units[unit]}`;
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const seen = new Set(files.map((f) => `${f.name}:${f.size}`));
    const incoming = Array.from(list).filter((f) => !seen.has(`${f.name}:${f.size}`));
    files = [...files, ...incoming];
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragging = false;
    addFiles(e.dataTransfer?.files ?? null);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    dragging = true;
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragging = false;
  };

  const handleSelect = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    addFiles(input.files);
    input.value = '';
  };

  const removeFile = (index: number) => {
    files = files.filter((_, i) => i !== index);
  };

  const handleConfirm = async () => {
    if (files.length === 0) return;
    await onConfirm(files);
    reset();
  };

  const reset = () => {
    files = [];
    dragging = false;
  };
</script>

<BaseDialog
  title="Import Asset"
  confirmText={files.length > 1 ? `Import ${files.length} files` : 'Import'}
  confirmDisabled={files.length === 0}
  bind:open
  onConfirm={handleConfirm}
>
  <div class="flex flex-col gap-3 py-2">
    <input
      bind:this={inputEl}
      type="file"
      multiple
      {accept}
      class="hidden"
      onchange={handleSelect}
    />

    <div
      role="button"
      tabindex="0"
      class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors {dragging
        ? 'border-primary bg-primary/5'
        : 'border-border hover:border-primary/50'}"
      ondrop={handleDrop}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      onclick={() => inputEl?.click()}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && inputEl?.click()}
    >
      <span class="i-ic-baseline-cloud-upload text-3xl text-muted-foreground"></span>
      <p class="text-sm text-muted-foreground">
        Drag & drop files here, or
        <span class="text-primary">browse</span>
      </p>
      <Button
        variant="outline"
        size="sm"
        onclick={(e) => {
          e.stopPropagation();
          inputEl?.click();
        }}
      >
        <span class="i-ic-baseline-folder-open mr-2 text-sm"></span>
        Browse files
      </Button>
    </div>

    {#if files.length > 0}
      <ScrollArea class="max-h-40">
        <div class="flex flex-col gap-1">
          {#each files as file, i (file.name + file.size)}
            <div
              class="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
            >
              <span class="i-ic-baseline-insert-drive-file shrink-0 text-muted-foreground"></span>
              <span class="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span>
              <span class="shrink-0 text-xs text-muted-foreground">{formatSize(file.size)}</span>
              <Button
                variant="ghost"
                size="icon"
                class="size-6 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onclick={() => removeFile(i)}
              >
                <span class="i-ic-round-close text-sm"></span>
              </Button>
            </div>
          {/each}
        </div>
      </ScrollArea>
    {/if}
  </div>
</BaseDialog>
