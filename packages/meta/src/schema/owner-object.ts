import { z } from 'zod';

import { REGISTRY_NAME } from './item-ref.schema';

const isOwnerKey = (key: string) => REGISTRY_NAME.test(key);
const OwnerObject = z.record(z.string(), z.unknown());

/**
 * Adds owner objects to a core object: any extra key must be a registry name, and its value is an
 * object only that owner parses. The core keeps it untouched.
 */
export const withOwners = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z
    .object(shape)
    .catchall(OwnerObject)
    .superRefine((value, ctx) => {
      for (const key of Object.keys(value)) {
        if (key in shape || isOwnerKey(key)) continue;
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'unknown field: owner keys are registry names ("@scope/name")',
        });
      }
    });

/** Owner objects of a core object (its keys that are registry names). */
export const ownerObjects = (value: object): Record<string, Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => isOwnerKey(key)) as [string, Record<string, unknown>][],
  );
