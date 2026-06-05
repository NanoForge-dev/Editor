import type { ProjectHandler } from '$lib/server/project';

import type { Save } from '@utils/types';

export class SaveHandler {
  private readonly handler: ProjectHandler;

  constructor(handler: ProjectHandler) {
    this.handler = handler;
  }

  async getSave(): Promise<Save> {
    return this.handler._rootFs.getFile(this.resolveSavePath()).readJson<Save>();
  }

  async updateSave(save: Save): Promise<void> {
    this.handler._rootFs.getFile(this.resolveSavePath()).writeJson(save);
  }

  private resolveSavePath(): string {
    return `.nanoforge/${this.handler._part}.save.json`;
  }
}
