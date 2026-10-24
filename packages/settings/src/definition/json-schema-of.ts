import { z } from 'zod';

import type { SettingDefinition } from './setting-definition.type';

/** JSON Schema of a setting's value, for the settings UI. */
export const jsonSchemaOf = (definition: SettingDefinition): unknown =>
  z.toJSONSchema(definition.schema, { unrepresentable: 'any' });
