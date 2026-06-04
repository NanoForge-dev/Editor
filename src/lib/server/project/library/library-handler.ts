import { type ProjectHandler } from '$lib/server/project';

import { formatFrom } from '@utils/format';

import { type LibraryPackage } from './library.type';

export class LibraryHandler {
  private readonly handler: ProjectHandler;

  constructor(handler: ProjectHandler) {
    this.handler = handler;
  }

  async installLibrary(name: string): Promise<LibraryPackage> {
    this.handler._cli.install([name], {
      server: this.handler._part === 'server' || undefined,
      lib: true,
    });

    return {
      save: {
        id: this._resolveIdFromName(name),
        type: '',
        name: '',
        path: name,
      },
    };
  }

  private _resolveIdFromName(name: string): string {
    const [org, pkg] = name.split('/');
    if (!org || !pkg) throw new Error('Invalid library name');
    const id = !pkg ? org : pkg;
    return `${formatFrom.kebab(id).toCamel()}Library`;
  }
}
