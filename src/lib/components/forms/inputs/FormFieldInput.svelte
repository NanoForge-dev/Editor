<script lang="ts">
  import { getContext } from 'svelte';
  import type { FormInstance } from '$lib/components/forms/form.svelte';
  import FormField from '$lib/components/forms/FormField.svelte';
  import { Input } from '$lib/components/ui/input';

  interface Props {
    name: string;
    label?: string;
    type?: string;
    placeholder?: string;
    class?: string;
    classNames?: {
      label?: string;
      input?: string;
    };
  }

  const { name, label, type, placeholder, class: className, classNames }: Props = $props();
  const formCtx = getContext<() => FormInstance>('form');
  const { form } = formCtx();
</script>

<FormField {name} {label} class={className} {classNames}>
  {#snippet children({ props })}
    <Input
      {...props}
      type={type ?? 'text'}
      {placeholder}
      class={classNames?.input}
      value={$form[name] ?? ''}
      oninput={(e) => form.update((v) => ({ ...v, [name]: e.currentTarget.value }))}
    />
  {/snippet}
</FormField>
