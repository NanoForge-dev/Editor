import { get } from 'svelte/store';

import { type Project } from '$lib/client/project';
import { save } from '$lib/components/Widget/EditorGame/game.svelte';

export class PackageHandler {
  private readonly handler: Project;

  constructor(handler: Project) {
    this.handler = handler;
  }

  async installComponent(name: string): Promise<void> {
    const newComponent = (
      await this.handler.actions.project.addComponents({ componentNames: [name] })
    )[0];

    const s = get(save);
    s.components.push(newComponent.save);
    save.set(s);
  }

  async installSystem(name: string): Promise<void> {
    const newSystem = (await this.handler.actions.project.addSystems({ systemNames: [name] }))[0];

    const s = get(save);
    s.systems.push(newSystem.save);
    save.set(s);
  }
}
