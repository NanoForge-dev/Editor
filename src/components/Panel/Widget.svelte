<script lang="ts">
  interface Props {
    size?: number;
    id?: string;
  }

  let { size, id }: Props = $props();
</script>

<div
  class="bg-neutral-800 w-full h-full rounded-md flex items-center justify-center text-white border border-neutral-600"
  style:flex-basis={size ? `${size}%` : '100%'}
  data-widget-id={id}
>
  <span class="text-sm">{id || 'Widget'}</span>
</div>
