import { z } from 'zod';

import { defineSetting } from './define-setting';
import type { SettingDefinition } from './setting-definition.type';

/**
 * Settings declared in a plugin manifest (`contributes.settings`): JSON only, so the value type
 * is described with a small JSON-schema-like vocabulary.
 */
const JsonType: z.ZodType<JsonTypeDeclaration> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('string'),
      enum: z.array(z.string()).optional(),
      pattern: z.string().optional(),
    }),
    z.object({
      type: z.literal('number'),
      integer: z.boolean().optional(),
      minimum: z.number().optional(),
      maximum: z.number().optional(),
    }),
    z.object({ type: z.literal('boolean') }),
    z.object({ type: z.literal('array'), items: JsonType }),
    z.object({ type: z.literal('record'), values: JsonType }),
  ]),
);

type JsonTypeDeclaration =
  | { type: 'string'; enum?: string[] | undefined; pattern?: string | undefined }
  | {
      type: 'number';
      integer?: boolean | undefined;
      minimum?: number | undefined;
      maximum?: number | undefined;
    }
  | { type: 'boolean' }
  | { type: 'array'; items: JsonTypeDeclaration }
  | { type: 'record'; values: JsonTypeDeclaration };

export const SettingDeclarationSchema = z.intersection(
  JsonType,
  z.object({
    key: z.string(),
    default: z.unknown(),
    title: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    order: z.number().optional(),
    tags: z.array(z.string()).optional(),
    scopes: z.array(z.enum(['account', 'machine', 'project', 'projectLocal'])).optional(),
    sync: z.boolean().optional(),
    mergeStrategy: z.enum(['replace', 'deep', 'union']).optional(),
    deprecated: z.string().optional(),
    renamedFrom: z.array(z.string()).optional(),
  }),
);
export type SettingDeclaration = z.output<typeof SettingDeclarationSchema>;

const toSchema = (declaration: JsonTypeDeclaration): z.ZodType => {
  switch (declaration.type) {
    case 'string': {
      if (declaration.enum?.length) return z.enum(declaration.enum as [string, ...string[]]);
      return declaration.pattern ? z.string().regex(new RegExp(declaration.pattern)) : z.string();
    }
    case 'number': {
      let schema = declaration.integer ? z.number().int() : z.number();
      if (declaration.minimum !== undefined) schema = schema.min(declaration.minimum);
      if (declaration.maximum !== undefined) schema = schema.max(declaration.maximum);
      return schema;
    }
    case 'boolean':
      return z.boolean();
    case 'array':
      return z.array(toSchema(declaration.items));
    case 'record':
      return z.record(z.string(), toSchema(declaration.values));
  }
};

/** Turns a manifest declaration into a definition; keys are prefixed with the plugin name. */
export const fromDeclaration = (
  declaration: SettingDeclaration,
  owner: string,
): SettingDefinition => {
  const key = declaration.key.startsWith(`${owner}.`)
    ? declaration.key
    : `${owner}.${declaration.key}`;
  return defineSetting({
    ...declaration,
    key,
    schema: toSchema(declaration),
    owner,
    ...(declaration.renamedFrom && {
      renamedFrom: declaration.renamedFrom.map((old) =>
        old.includes('/') ? old : `${owner}.${old}`,
      ),
    }),
  });
};
