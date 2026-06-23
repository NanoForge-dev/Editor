import { getContext, setContext } from 'svelte';

const MARKETPLACE_CONTEXT_KEY = 'marketplace';

export interface MarketplaceContext {
  open: () => void;
}

export function setMarketplaceContext(ctx: MarketplaceContext): void {
  setContext(MARKETPLACE_CONTEXT_KEY, ctx);
}

export function getMarketplaceContext(): MarketplaceContext {
  return getContext<MarketplaceContext>(MARKETPLACE_CONTEXT_KEY);
}
