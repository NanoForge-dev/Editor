import {
  type SettingDefinition,
  type SettingsService,
  type WritableScope,
  jsonSchemaOf,
} from '@nanoforge-dev/editor-sdk';

export type Control =
  | { kind: 'boolean' }
  | { kind: 'enum'; options: string[] }
  | { kind: 'number'; min?: number; max?: number; integer: boolean }
  | { kind: 'string' }
  | { kind: 'lines' }
  | { kind: 'json' };

/** The control a setting's schema calls for. */
export const controlOf = (definition: SettingDefinition): Control => {
  const schema = jsonSchemaOf(definition) as {
    type?: string;
    enum?: unknown[];
    minimum?: number;
    maximum?: number;
    items?: { type?: string };
  };
  if (schema.enum?.every((value) => typeof value === 'string')) {
    return { kind: 'enum', options: schema.enum as string[] };
  }
  switch (schema.type) {
    case 'boolean':
      return { kind: 'boolean' };
    case 'number':
    case 'integer':
      return {
        kind: 'number',
        integer: schema.type === 'integer',
        ...(schema.minimum !== undefined && { min: schema.minimum }),
        ...(schema.maximum !== undefined && { max: schema.maximum }),
      };
    case 'string':
      return { kind: 'string' };
    case 'array':
      return schema.items?.type === 'string' ? { kind: 'lines' } : { kind: 'json' };
    default:
      return { kind: 'json' };
  }
};

/**
 * Where a change goes by default: the scope the value comes from, else the account (when
 * signed in) or this machine, else the first scope the setting allows.
 */
export const defaultScope = (
  settings: SettingsService,
  definition: SettingDefinition,
): WritableScope => {
  const { effectiveScope } = settings.inspect(definition);
  const allowed = definition.scopes.filter((scope) => settings.hasStore(scope));
  if (effectiveScope !== 'default' && allowed.includes(effectiveScope)) return effectiveScope;
  for (const scope of ['account', 'machine', 'project', 'projectLocal'] as const) {
    if (allowed.includes(scope)) return scope;
  }
  return definition.scopes[0] ?? 'machine';
};
