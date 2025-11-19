<script lang="ts">
    import type {ContentBrowserItem} from "./types";
    import Self from './ContentBrowserListFolder.svelte';

    interface Props {
        item: ContentBrowserItem;
        deepness?: number;
        select: (ids: string[]) => void;
        selected: string[];
    }
    let {item, deepness = 0, select, selected = $bindable()}: Props = $props();

    let open: boolean = $derived(!!selected.find(s => s === item.id));

    function toggle() {
        if (item.children) open = !open;
    }

    function hasFolderChildren(item: ContentBrowserItem): boolean {
        if (!item.children) return false;
        for (let i = 0; i < item.children.length; i++ ) {
            if (item.children[i].type === 'folder') {
                return true;
            }
        }
        return false;
    }
</script>

{#if (item.type === 'folder') }
    <button
        class="hover:bg-neutral-800 cursor-pointer flex items-center h-5 text-xs text-neutral-200"
        style={`padding-left: ${deepness * 8}px`}
        onclick={() => select([item.id])}
    >
        {#if hasFolderChildren(item)}
            <span onclick={toggle} aria-hidden="true" class="{open ? 'i-solar-alt-arrow-down-bold' : 'i-solar-alt-arrow-right-bold'} w-4 text-center select-none text-neutral-400 hover:text-neutral-200"></span>
        {:else}
            <span class="w-4"></span>
        {/if}

        <span>{item.name}</span>
    </button>

    {#if open && item.children}
        {#each item.children as child, i (i)}
            <Self
                item={child}
                deepness={deepness + 1}
                select={(ids) => {
                    ids.unshift(item.id);
                    return select(ids);
                }}
                bind:selected={selected}
            />
        {/each}
    {/if}
{/if}