<script lang="ts">
  import { getContext } from 'svelte';
  import type { FormInstance } from '$lib/components/forms/form.svelte';
  import FormField from '$lib/components/forms/FormField.svelte';
  import { Switch } from '$lib/components/ui/switch';

  interface Props {
    name: string;
    label?: string;
    description?: string;
    class?: string;
    classNames?: { label?: string };
    disabled?: boolean;
  }

  const { name, label, description, class: className, classNames, disabled }: Props = $props();
  const formCtx = getContext<() => FormInstance>('form');
  const { form } = formCtx();
</script>

<FormField {name} {label} {description} class={className} {classNames}>
  {#snippet children({ props })}
    <Switch
      {...props}
      {disabled}
      checked={$form[name]}
      onCheckedChange={(v) => form.update((s) => ({ ...s, [name]: v }))}
    />
  {/snippet}
</FormField>
