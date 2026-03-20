import { type Tab, tabTypes } from '$lib/components/Tabs/types';
import { type Writable, writable } from 'svelte/store';

export const tabsStore: Writable<Tab[]> = writable([{ type: tabTypes[0], title: 'Game' }]);
export const tabSelectedStore: Writable<number> = writable(0);
