<script lang="ts" module>
  import type { ButtonProps } from '$lib/components/ui/button';

  export type LoadingButtonProps = ButtonProps & {
    loading?: boolean;
  };
</script>

<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';

  let { loading = false, disabled, children, ...restProps }: LoadingButtonProps = $props();
</script>

<Button disabled={disabled || loading} {...restProps}>
  {#if loading}
    <Spinner />
  {/if}
  {@render children?.()}
</Button>
