import { describe, expect, it } from 'vitest';

import { itemFileTemplates } from '../../src/create/item-file-templates';

const apps = [
  { root: 'apps/server', type: 'server' },
  { root: 'libs/shared', type: 'lib' },
] as never[];

describe('itemFileTemplates', () => {
  const [component, system] = itemFileTemplates(() => apps);

  it('are offered in apps and shared libraries only', () => {
    expect(component!.when).toBe('appType');
    expect(system!.category).toBe('ECS');
  });

  it("writes the item for the side of the folder's app, in kebab case", async () => {
    const [file] = await component!.create({
      folder: 'libs/shared/src/x',
      name: 'PlayerHealth.ts',
    });
    expect(file!.path).toBe('player-health.ts');
    expect(file!.content).toContain('export class PlayerHealth');
    expect(file!.content).toContain('@side shared');
    const [tick] = await system!.create({ folder: 'apps/server/src', name: 'tick' });
    expect(tick!.content).toContain('@nanoforge-dev/ecs/server');
  });

  it('refuses a name of the wrong case, and a folder outside every app', () => {
    expect(() => component!.create({ folder: 'apps/server', name: 'health' })).toThrow(/capital/);
    expect(() => system!.create({ folder: 'docs', name: 'tick' })).toThrow(/no app/);
  });
});
