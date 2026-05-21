<script lang="ts">
  import { getContext } from 'svelte';
  import type { FormInstance } from '$lib/components/forms/form.svelte';
  import FormField from '$lib/components/forms/FormField.svelte';
  import * as Select from '$lib/components/ui/select';

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
    classNames?: { label?: string; trigger?: string; content?: string; item?: string };
    disabled?: boolean;
  }

  const {
    name,
    label,
    description,
    placeholder = 'Select...',
    options,
    class: className,
    classNames,
    disabled,
  }: Props = $props();

  const formCtx = getContext<() => FormInstance>('form');
  const { form } = formCtx();

  const triggerContent = $derived(
    options.find((f) => f.value === $form[name])?.label ?? placeholder,
  );
</script>

<FormField {name} {label} {description} class={className} {classNames}>
  {#snippet children({ props })}
    <Select.Root
      type="single"
      value={String(($form as any)[name] ?? '')}
      onValueChange={(v: string) => form.update((s) => ({ ...s, [name]: v }))}
    >
      <Select.Trigger {...props} {disabled} class={classNames?.trigger}>
        {triggerContent}
      </Select.Trigger>
      <Select.Content class={classNames?.content}>
        {#each options as option (option.value)}
          <Select.Item value={option.value} label={option.label} class={classNames?.item} />
        {/each}
      </Select.Content>
    </Select.Root>
  {/snippet}
</FormField>
