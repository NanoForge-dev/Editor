<script lang="ts">
  import {
    InputGroup,
    InputGroupInput,
    InputGroupAddon,
    InputGroupButton,
  } from '$lib/components/ui/input-group';
  import { Spinner } from '$lib/components/ui/spinner';

  interface Props {
    search: string;
    isFetching: boolean;
    onChange: () => void;
    onClear: () => void;
  }

  let { search = $bindable(), isFetching, onChange, onClear }: Props = $props();
</script>

<div class="relative">
  <InputGroup>
    <InputGroupInput placeholder="Search packages..." bind:value={search} onchange={onChange} />
    <InputGroupAddon>
      {#if isFetching}
        <Spinner />
      {:else}
        <span class="i-ic-baseline-search"></span>
      {/if}
    </InputGroupAddon>
    {#if search}
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          onclick={onClear}
          variant="ghost"
          class="rounded-md text-destructive hover:text-destructive hover:bg-destructive/10"
        ></InputGroupButton>
      </InputGroupAddon>
    {/if}
  </InputGroup>
</div>
