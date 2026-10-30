import { getContext, setContext } from 'svelte';

const KEY = Symbol('ecs.assets');

/** The assets an `@asset` param can pick, with the extensions it accepts. */
export type AssetList = (accept: readonly string[]) => readonly string[];

/** Gives the fields below the assets of the app being edited (their pickers). */
export const provideAssets = (list: AssetList): void => void setContext(KEY, list);

/** The assets given by an inspector above; undefined where none is (a plain text field then). */
export const assetList = (): AssetList | undefined => getContext<AssetList | undefined>(KEY);
