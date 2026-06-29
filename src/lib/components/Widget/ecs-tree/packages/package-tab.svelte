<script lang="ts">
  import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
  } from '$lib/components/ui/dropdown-menu';
  import PackageRow from './package-row.svelte';
  import DialogCreatePackage from './dialog-create-package.svelte';
  import DialogCreateAsset from '../assets/dialog-create-asset.svelte';
  import { Button } from '$lib/components/ui/button';
  import { getMarketplaceContext } from '$lib/components/marketplace';
  import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
  } from '$lib/components/ui/input-group';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { capitalize } from '@utils/string';
  import {
    type ComponentManager,
    type SystemManager,
    type LibraryManager,
    type AssetManager,
  } from '$lib/client/ecs';
  import type { Writable } from 'svelte/store';
  import type { Package } from '../types';
  import { formatFrom } from '@utils/format';
  import { getContext } from 'svelte';

  type Props =
    | {
        type: 'asset';
        manager: AssetManager;
      }
    | {
        type: 'component';
        manager: ComponentManager;
      }
    | {
        type: 'system';
        manager: SystemManager;
      }
    | {
        type: 'library';
        manager: LibraryManager;
      };

  const { type, manager }: Props = $props();

  const packages = $derived<Writable<Package[]>>(manager.store);

  const nameCapitalized = $derived(capitalize(type));
  const namePlural = $derived(type === 'library' ? 'libraries' : type + 's');

  const ecsQuery = getContext<{ packages: string }>('ecsQuery');
  const marketplace = getMarketplaceContext();

  let query = $state('');

  $effect(() => {
    const q = `${ecsQuery.packages}`;
    if (q.length > 0) {
      setTimeout(() => {
        query = q;
        ecsQuery.packages = '';
      });
    }
  });

  const sorted = $derived(
    $packages
      .filter((c) => !query || (c.name ?? c.id).toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id)),
  );

  let createOpen = $state(false);

  const handleCreate = async (name: string) => {
    if (!('create' in manager) || type === 'asset')
      throw new Error(`Cannot create in library - use the "Import Library" button instead.`);
    await manager.create(name);
  };

  const handleImportAsset = async (files: File[]) => {
    if (type !== 'asset') return;
    await manager.createMany(files);
  };

  const validate = (raw: string, suffix: string = nameCapitalized) => {
    if (!raw) return 'Name is required';
    const name = `${formatFrom.all(raw)[type === 'system' ? 'toCamel' : 'toPascal']()}${suffix}`;
    console.log(name, $packages);
    if ($packages.find((p) => p.id === name)) return `${nameCapitalized} already exists`;
    return null;
  };
</script>

{#if type === 'asset'}
  <DialogCreateAsset bind:open={createOpen} onConfirm={handleImportAsset} />
{:else}
  <DialogCreatePackage
    name={nameCapitalized}
    bind:open={createOpen}
    onConfirm={handleCreate}
    {validate}
  />
{/if}

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
      <DropdownMenuTrigger disabled={type === 'library'}>
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
        {#if type === 'asset'}
          <DropdownMenuItem onclick={() => (createOpen = true)}>
            <span class="i-ic-baseline-note-add mr-2 text-sm"></span>
            Upload
          </DropdownMenuItem>
        {:else if type !== 'library'}
          <DropdownMenuItem onclick={() => (createOpen = true)}>
            <span class="i-ic-baseline-note-add mr-2 text-sm"></span>
            Create
          </DropdownMenuItem>
        {/if}
        <DropdownMenuItem onclick={() => marketplace.open()}>
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
