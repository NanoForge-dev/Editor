<script lang="ts">
  import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
  } from '$lib/components/ui/dropdown-menu';
  import PackageRow from './package-row.svelte';
  import DialogCreatePackage from './dialog-create-package.svelte';
  import DialogImportPackage from './dialog-import-package.svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
  } from '$lib/components/ui/input-group';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { capitalize } from '@utils/string';
  import type { ComponentManager, SystemManager } from '$lib/client/ecs';

  type Props =
    | {
        type: 'component';
        manager: ComponentManager;
      }
    | {
        type: 'system';
        manager: SystemManager;
      };

  const { type, manager }: Props = $props();

  const packages = $derived(manager.store);

  const nameCapitalized = $derived(capitalize(type));
  const namePlural = $derived(type + 's');

  let query = $state('');

  const sorted = $derived(
    $packages
      .filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  let createOpen = $state(false);
  let importOpen = $state(false);

  const handleCreate = (name: string) => {
    // @todo create package
    manager.add({
      name,
      params: [],
    });
  };

  const handleImport = (name: string) => {
    // @todo import package
    manager.add({
      name,
      params: [],
    });
  };
</script>

<DialogCreatePackage name={nameCapitalized} bind:open={createOpen} onConfirm={handleCreate} />
<DialogImportPackage name={nameCapitalized} bind:open={importOpen} onConfirm={handleImport} />

<div class="flex flex-col flex-1 min-h-0">
  <div class="flex items-center gap-1.5 px-2 py-1.5 border-b border-border shrink-0">
    <InputGroup>
      <InputGroupInput placeholder={`Search ${namePlural}...`} bind:value={query} />
      <InputGroupAddon>
        <span class="i-ic-baseline-search"></span>
      </InputGroupAddon>
      {#if query}
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            onclick={() => (query = '')}
            variant="ghost"
            class="rounded-md text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <span class="i-ic-round-close"></span>
          </InputGroupButton>
        </InputGroupAddon>
      {/if}
    </InputGroup>
    <DropdownMenu>
      <DropdownMenuTrigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            size="icon"
            class="size-7 hover:bg-accent hover:text-accent-foreground"
          >
            <span class="i-ic-baseline-add text-base"></span>
          </Button>
        {/snippet}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onclick={() => (createOpen = true)}>
          <span class="i-ic-baseline-note-add mr-2 text-sm"></span>
          Create
        </DropdownMenuItem>
        <DropdownMenuItem onclick={() => (importOpen = true)}>
          <span class="i-ic-baseline-file-upload mr-2 text-sm"></span>
          Import
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  <ScrollArea class="flex-1">
    {#each sorted as pkg (pkg.id)}
      {@const handle = manager.get(pkg.id)}
      <PackageRow type={type as any} handle={handle as any} />
    {/each}

    {#if sorted.length === 0}
      <div class="py-12 text-center text-xs text-muted-foreground">
        {query ? 'No matches.' : `No ${namePlural} - add one with +.`}
      </div>
    {/if}
  </ScrollArea>
</div>
