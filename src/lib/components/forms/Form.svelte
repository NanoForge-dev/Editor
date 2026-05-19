<script lang="ts">
  import { setContext, type Snippet } from 'svelte';
  import type { FormInstance } from './form.svelte';

  interface Props {
    form: FormInstance;
    class?: string;
    children: Snippet;
  }

  let { form, class: className, children }: Props = $props();

  setContext('form', {
    get values() {
      return form.values;
    },
    get errors() {
      return form.errors;
    },
    get isSubmitting() {
      return form.isSubmitting;
    },
    get handleChange() {
      return form.handleChange;
    },
    get handleSubmit() {
      return form.handleSubmit;
    },
    get reset() {
      return form.reset;
    },
  } satisfies FormInstance);
</script>

<form onsubmit={form.handleSubmit} class={className}>
  {@render children()}
</form>
