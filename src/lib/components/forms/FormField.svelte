<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import type { FormInstance } from './form.svelte';
  import { Label } from 'flowbite-svelte';

  interface Props {
    name: string;
    label?: string;
    class?: string;
    classNames?: { label?: string; error?: string };
    children: Snippet<[{ id: string; name: string; value: any; handleChange: (e: Event) => void }]>;
  }

  const { name, label, class: className, classNames, children }: Props = $props();
  const form = getContext<FormInstance>('form');
</script>

<div class={className}>
  {#if label}
    <Label for="form-{name}" class={classNames?.label}>{label}</Label>
  {/if}
  {@render children({
    id: `form-${name}`,
    name,
    value: form.values[name],
    handleChange: form.handleChange,
  })}
  {#if form.errors[name]}
    <small class={['text-red-500 text-sm mt-1', classNames?.error]}>{form.errors[name]}</small>
  {/if}
</div>
