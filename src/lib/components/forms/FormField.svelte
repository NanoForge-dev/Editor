<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import type { FormInstance } from './form.svelte';
  import * as Form from '$lib/components/ui/form';
  import { cn } from '@utils/ui';

  interface Props {
    name: string;
    label?: string;
    description?: string;
    class?: string;
    classNames?: { label?: string; description?: string };
    children: Snippet<[{ props: any }]>;
  }

  const {
    name,
    label,
    description,
    class: className,
    classNames,
    children: fieldChildren,
  }: Props = $props();
  const formCtx = getContext<() => FormInstance>('form');
</script>

<Form.Field form={formCtx()} {name} class={cn('flex flex-col gap-2', className)}>
  <Form.Control>
    {#snippet children({ props })}
      {#if label}
        <Form.Label class={classNames?.label}>{label}</Form.Label>
      {/if}
      {@render fieldChildren({ props })}
    {/snippet}
  </Form.Control>
  {#if description}
    <Form.Description class={classNames?.description}>{description}</Form.Description>
  {/if}
  <Form.FieldErrors class="text-sm text-destructive" />
</Form.Field>
