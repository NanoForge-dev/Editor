import { get } from 'svelte/store';

import { type Project } from '$lib/client/project';

import { infoStore } from './info.store';
import type { ProjectInfo } from './info.type';

export class InfoHandler {
  static reset(): void {
    infoStore.set(null);
  }

  constructor(private readonly core: Project) {}

  get(cacheOnly: true): ProjectInfo | null;
  get(): Promise<ProjectInfo>;
  get(cacheOnly?: boolean): ProjectInfo | null | Promise<ProjectInfo> {
    if (cacheOnly) return get(infoStore);
    return this.fetch();
  }

  fetch(noCache: boolean = false): Promise<ProjectInfo> {
    // @todo implement
    void noCache;
    return Promise.reject('Not implemented yet');
  }

  async set(input: Partial<ProjectInfo>): Promise<void> {
    // @todo implement
    void input;
    await this.fetch(true);
  }
}
