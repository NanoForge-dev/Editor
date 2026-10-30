import { describe, expect, it, vi } from 'vitest';

import type { ContextKeyService } from '@nanoforge-dev/editor-sdk';

import { entityActionEntries } from '../../src/widgets/hierarchy/entity-action-entries';

/** Context keys reading `key`, `key == 'x'` and throwing on `!!`. */
const contextKeys = {
  createScoped: () => {
    const values = new Map<string, unknown>();
    return {
      set: (key: string, value: unknown) => values.set(key, value),
      dispose: () => values.clear(),
      evaluate: (when: string | undefined) => {
        if (!when) return true;
        if (when.startsWith('!!')) throw new Error('Invalid when clause');
        if (!when.includes('==')) return values.get(when) === true;
        const [key, value] = when.split('==').map((part) => part.trim().replace(/^'|'$/g, ''));
        return values.get(key!) === value;
      },
    };
  },
} as unknown as ContextKeyService;

describe('entityActionEntries', () => {
  const ball = {
    name: 'ball',
    components: [{ className: 'Position' }, { className: 'Velocity' }],
  } as never;
  const target = { app: 'apps/client', entity: 'ball', path: 'apps/client/src/main.ts' };

  it('offers the actions whose when holds, after a separator, running their command', () => {
    const run = vi.fn();
    const entries = entityActionEntries(
      [
        { id: 'greet', title: 'Greet', command: 'hello.greet' },
        { id: 'move', title: 'Move', command: 'acme.move', when: 'ecsComponent:Position' },
        { id: 'size', title: 'Size', command: 'acme.size', when: 'ecsComponent:Size' },
        { id: 'broken', title: 'Broken', command: 'acme.broken', when: '!!' },
        { id: 'paddle', title: 'Paddle', command: 'acme.paddle', when: "ecsEntity == 'paddle'" },
      ],
      ball,
      target,
      contextKeys,
      run,
    );
    expect(entries.map((entry) => ('label' in entry ? entry.label : entry.kind))).toEqual([
      'separator',
      'Greet',
      'Move',
    ]);
    const move = entries[2] as { onSelect: () => void };
    move.onSelect();
    expect(run).toHaveBeenCalledWith('acme.move', target);
  });

  it('adds nothing without actions that apply', () => {
    expect(entityActionEntries([], ball, target, contextKeys, vi.fn())).toEqual([]);
  });
});
