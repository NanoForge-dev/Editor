<script lang="ts">
  import { setContext, type Snippet } from 'svelte';
  interface FormLike {
    enhance: (el: HTMLFormElement) => { destroy: () => void };
  }

  interface Props {
    form: FormLike;
    class?: string;
    children: Snippet;
  }

  let { form, class: className, children }: Props = $props();

  setContext('form', () => form);
</script>

<form use:form.enhance class={className}>
  {@render children()}
</form>
