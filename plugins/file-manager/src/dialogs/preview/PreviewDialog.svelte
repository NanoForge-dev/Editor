<script lang="ts">
  import { Button, Dialog } from '@nanoforge-dev/editor-sdk/ui';

  interface Props {
    /** Project path of the file. */
    path: string;
    url: string;
    kind: 'image' | 'audio' | 'video';
    ondownload: () => void;
    onclose: () => void;
  }

  // svelte-ignore state_referenced_locally
  const { path, url, kind, ondownload, onclose }: Props = $props();
  let open = $state(true);
  let size = $state('');
  /** Pixel art and icons are shown enlarged, with sharp pixels. */
  let small = $state(false);

  const close = () => {
    open = false;
    onclose();
  };
</script>

<Dialog bind:open title={path.split('/').at(-1) ?? path} width="min(900px, 92vw)" onclose={close}>
  <div class="preview">
    {#if kind === 'image'}
      <img
        src={url}
        alt={path}
        class:small
        onload={(event) => {
          const image = event.currentTarget as HTMLImageElement;
          size = `${image.naturalWidth} × ${image.naturalHeight}`;
          small = image.naturalWidth <= 64 && image.naturalHeight <= 64;
        }}
      />
    {:else if kind === 'audio'}
      <audio src={url} controls aria-label={path}></audio>
    {:else}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video src={url} controls aria-label={path}></video>
    {/if}
  </div>
  <p class="meta">{path}{size ? ` · ${size}` : ''}</p>
  {#snippet footer()}
    <Button onclick={ondownload}>Download</Button>
    <Button variant="primary" onclick={close}>Close</Button>
  {/snippet}
</Dialog>

<style>
  .preview {
    display: grid;
    place-items: center;
    min-height: 160px;
    /* The dialog is at most 70vh, with its header and footer. */
    max-height: calc(70vh - 170px);
    border-radius: var(--nf-radius-control);
    /* A checkerboard shows through transparent images. */
    background: repeating-conic-gradient(
        var(--nf-color-sunken) 0% 25%,
        var(--nf-color-surface) 0% 50%
      )
      50% / 16px 16px;
    overflow: auto;
  }
  img,
  video {
    max-width: 100%;
    max-height: calc(70vh - 170px);
    image-rendering: auto;
  }
  img.small {
    width: 128px;
    height: 128px;
    object-fit: contain;
    image-rendering: pixelated;
  }
  .meta {
    margin: var(--nf-space-2) 0 0;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
</style>
