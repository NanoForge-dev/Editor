import { get } from 'svelte/store';

import type { Project } from '$lib/client/project';

import { infoStore } from './info.store';
import type { ProjectInfo, ProjectInfoInput } from './info.type';

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

  async fetch(noCache: boolean = false): Promise<ProjectInfo> {
    if (!noCache) {
      const cache = get(infoStore);
      if (cache) return cache;
    }
    const res = await this.core.actions.project.getInfo();
    infoStore.set(res);
    return res;
  }

  async set(input: ProjectInfoInput): Promise<void> {
    await this.core.actions.project.setInfo(input);
    await this.fetch(true);
  }
}
