<script lang="ts">
  import { getContext } from 'svelte';
  import type { FormInstance } from '$lib/components/forms/form.svelte';
  import FormField from '$lib/components/forms/FormField.svelte';
  import { MultiSelect } from '$lib/components/ui/multi-select';

  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    name: string;
    label?: string;
    description?: string;
    placeholder?: string;
    options: Option[];
    class?: string;
    classNames?: { label?: string; trigger?: string };
    disabled?: boolean;
  }

  const {
    name,
    label,
    description,
    placeholder,
    options,
    class: className,
    classNames,
    disabled,
  }: Props = $props();

  const formCtx = getContext<() => FormInstance>('form');
  const { form } = formCtx();
</script>

<FormField {name} {label} {description} class={className} {classNames}>
  {#snippet children({ props })}
    <MultiSelect
      {...props}
      {options}
      {placeholder}
      {disabled}
      class={classNames?.trigger}
      value={Array.isArray(($form as any)[name]) ? ($form as any)[name] : []}
      onValueChange={(v) => form.update((s) => ({ ...s, [name]: v }))}
    />
  {/snippet}
</FormField>
