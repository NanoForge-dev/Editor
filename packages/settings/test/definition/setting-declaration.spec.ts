import { describe, expect, it } from 'vitest';

import { fromDeclaration } from '../../src';

describe('manifest declarations', () => {
  it('builds prefixed definitions with json types', () => {
    const definition = fromDeclaration(
      {
        key: 'gizmos.size',
        type: 'number',
        integer: true,
        minimum: 1,
        default: 8,
        scopes: ['machine'],
      },
      '@nanoforge/ecs',
    );
    expect(definition.key).toBe('@nanoforge/ecs.gizmos.size');
    expect(definition.schema.safeParse(0).success).toBe(false);
    expect(definition.scopes).toEqual(['machine']);
    expect(() => fromDeclaration({ key: 'bad', type: 'boolean', default: 'yes' }, '@a/b')).toThrow(
      /Default/,
    );
  });
});
