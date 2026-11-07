import { type RegistryItem, type SearchQuery, type SearchResult } from '../item/item.schema';

export type RegistryErrorCode =
  'NOT_FOUND' | 'UNAVAILABLE' | 'INVALID' | 'INTEGRITY' | 'CONFLICT' | 'IN_USE';

/** Where items come from: an HTTP registry, or a folder standing in for it. */
export interface Registry {
  search(query?: SearchQuery): Promise<SearchResult>;
  /** Rejects with `NOT_FOUND` for an unknown name. */
  get(name: string): Promise<RegistryItem>;
  /** The archive of a version: a zip with `nanoforge.manifest.json` at its root. */
  download(name: string, version: string): Promise<Uint8Array>;
}
