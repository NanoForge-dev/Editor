import { describe, expect, it, vi } from 'vitest';

import type { SettingDefinition } from '@nanoforge-dev/editor-sdk';

import { controlOf, defaultScope } from '../../src/settings/setting-control';

vi.mock('@nanoforge-dev/editor-sdk', async (original) => ({
  ...(await original<object>()),
  /** The tests give their JSON schema as the setting's schema. */
  jsonSchemaOf: (definition: { schema: unknown }) => definition.schema,
}));

const definition = (schema: unknown, scopes: string[] = ['account', 'machine']) =>
  ({ key: 'x.y', schema, scopes }) as unknown as SettingDefinition;

describe('controlOf', () => {
  it('picks the control the schema calls for', () => {
    expect(controlOf(definition({ type: 'boolean' }))).toEqual({ kind: 'boolean' });
    expect(controlOf(definition({ type: 'string', enum: ['a', 'b'] }))).toEqual({
      kind: 'enum',
      options: ['a', 'b'],
    });
    expect(controlOf(definition({ type: 'integer', minimum: 1, maximum: 9 }))).toEqual({
      kind: 'number',
      integer: true,
      min: 1,
      max: 9,
    });
    expect(controlOf(definition({ type: 'number' }))).toEqual({ kind: 'number', integer: false });
    expect(controlOf(definition({ type: 'string' }))).toEqual({ kind: 'string' });
    expect(controlOf(definition({ type: 'array', items: { type: 'string' } }))).toEqual({
      kind: 'lines',
    });
    expect(controlOf(definition({ type: 'array', items: { type: 'number' } }))).toEqual({
      kind: 'json',
    });
    expect(controlOf(definition({ type: 'object' }))).toEqual({ kind: 'json' });
  });
});

describe('defaultScope', () => {
  const settings = (effectiveScope: string, stores: string[]) =>
    ({
      inspect: () => ({ effectiveScope }),
      hasStore: (scope: string) => stores.includes(scope),
    }) as never;

  it('writes where the value comes from, else the account, else this machine', () => {
    const both = definition({}, ['account', 'machine', 'project']);
    expect(defaultScope(settings('project', ['account', 'machine', 'project']), both)).toBe(
      'project',
    );
    expect(defaultScope(settings('default', ['account', 'machine']), both)).toBe('account');
    expect(defaultScope(settings('default', ['machine']), both)).toBe('machine');
    expect(defaultScope(settings('project', ['machine']), both)).toBe('machine');
    expect(defaultScope(settings('default', []), definition({}, ['projectLocal']))).toBe(
      'projectLocal',
    );
  });
});
