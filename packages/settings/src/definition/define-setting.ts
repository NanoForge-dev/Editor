import { WRITABLE_SCOPES } from '../scope/setting-scope.enum';
import type { SettingDefinition, SettingInput } from './setting-definition.type';

const KEY_PATTERN = /^(@[a-z0-9][\w-]*\/[a-z0-9][\w-]*|[a-z0-9][\w-]*)(\.[a-zA-Z0-9][\w-]*)+$/;

/** Declares a setting in code. The default value must satisfy the schema. */
export const defineSetting = <T>(input: SettingInput<T>): SettingDefinition<T> => {
  if (!KEY_PATTERN.test(input.key)) throw new Error(`Invalid setting key "${input.key}"`);
  const parsed = input.schema.safeParse(input.default);
  if (!parsed.success) throw new Error(`Default of "${input.key}" does not match its schema`);
  const sync = input.sync ?? true;
  const scopes = (input.scopes ?? WRITABLE_SCOPES).filter((scope) => sync || scope !== 'account');
  return Object.freeze({
    key: input.key,
    schema: input.schema,
    default: parsed.data,
    scopes,
    sync,
    mergeStrategy: input.mergeStrategy ?? 'replace',
    title: input.title ?? input.key,
    description: input.description ?? '',
    category: input.category ?? 'Other',
    order: input.order ?? 0,
    tags: input.tags ?? [],
    ...(input.deprecated && { deprecated: input.deprecated }),
    renamedFrom: input.renamedFrom ?? [],
    owner: input.owner ?? 'core',
  });
};
