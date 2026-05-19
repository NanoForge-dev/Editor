<script lang="ts">
  import FormField from '$lib/components/forms/FormField.svelte';

  interface Props {
    name: string;
    label?: string;
    type?: string;
    placeholder?: string;
    class?: string;
    classNames?: {
      label?: string;
      input?: string;
      error?: string;
    };
  }

  const { name, label, type, placeholder, class: className, classNames }: Props = $props();
</script>

<FormField {label} {name} class={className}>
  {#snippet children({ id, name, value, handleChange })}
    <input
      {id}
      {name}
      value={value ?? ''}
      type={type ?? 'text'}
      oninput={handleChange}
      {placeholder}
      class={classNames?.input}
    />
  {/snippet}
</FormField>
