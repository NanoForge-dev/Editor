import { describe, expect, it, vi } from 'vitest';

import { createItem, kebab, validateItemName } from '../../src/create/create-item';

const app = (type: string) =>
  ({
    type,
    dirs: { components: `apps/${type}/src/components`, systems: `apps/${type}/src/systems` },
  }) as never;

const project = (existing: string[] = []) => {
  const files = new Map<string, string>();
  return {
    files,
    fs: {
      entry: (path: string) => (existing.includes(path) ? { path } : undefined),
      write: vi.fn(async (path: string, text: string) => void files.set(path, text)),
    },
  };
};

describe('createItem', () => {
  it('names files in kebab case', () => {
    expect(kebab('PlayerHealth')).toBe('player-health');
    expect(kebab('moveBall2D')).toBe('move-ball2-d');
    expect(kebab('__x  y__')).toBe('x-y');
  });

  it('refuses names that are not identifiers of the right case', () => {
    expect(validateItemName('component', '2D')).toMatch(/not starting with a digit/);
    expect(validateItemName('component', 'player')).toMatch(/capital letter/);
    expect(validateItemName('system', 'Move')).toMatch(/lowercase/);
    expect(validateItemName('system', 'move')).toBeUndefined();
  });

  it("writes a tagged component for the app's side, shared in a library", async () => {
    const target = project();
    const path = await createItem(target as never, 'component', 'Health', app('lib'));
    expect(path).toBe('apps/lib/src/components/health.ts');
    expect(target.files.get(path)).toContain('@side shared');
    expect(target.files.get(path)).toContain('export class Health {');
  });

  it("writes a system on the side's ECS, and never over a file", async () => {
    const target = project(['apps/server/src/systems/tick.ts']);
    const path = await createItem(target as never, 'system', 'move', app('server'));
    expect(target.files.get(path)).toContain('from "@nanoforge-dev/ecs/server"');
    expect(target.files.get(path)).toContain('@side server');
    await expect(createItem(target as never, 'system', 'tick', app('server'))).rejects.toThrow(
      'already exists',
    );
  });
});
