import { z } from 'zod';

import { ExportRef } from './item-ref.schema';
import { withOwners } from './owner-object';

/** A CSS color, as written in the tag (`orange`, `#4aa3ff`, `rgb(…)`). */
const CssColor = z.string().min(1);

/** How a param or field looks in the inspector. Every field is optional. */
export const ElementLayout = z.object({
  /** Name shown instead of the param name. */
  label: z.string().optional(),
  /** The group it belongs to (`ItemMeta.groups[].name`). */
  group: z.string().optional(),
  /** A visual preset, and the slot it fills: `{ id: "vector", slot: "x" }`, `{ id: "color" }`. */
  preset: z.object({ id: z.string(), slot: z.string().optional() }).optional(),
  /** Color of its name. */
  color: CssColor.optional(),
  /** Hidden until the user chooses to show it. */
  hidden: z.boolean().optional(),
});
export type ElementLayout = z.output<typeof ElementLayout>;

/** A group of params, declared in the item's header (`@group Coords color=… hidden - …`). */
export const ParamGroup = z.object({
  name: z.string(),
  description: z.string().optional(),
  color: CssColor.optional(),
  hidden: z.boolean().optional(),
});
export type ParamGroup = z.output<typeof ParamGroup>;

export interface EnumMember {
  readonly name: string;
  readonly value: string | number;
}

interface ElementCommon {
  name: string;
  description?: string;
  /** Default false; true when the param has a default or `?`. */
  optional?: boolean;
  deprecated?: string;
  layout?: ElementLayout;
  /** The initializer's source text when it isn't a JSON value (`new Rect({ width: 10 })`). */
  defaultCode?: string;
  [owner: `@${string}/${string}`]: Record<string, unknown>;
}

/**
 * A value's type. Core types describe TypeScript, not a lib.
 * `default` is a JSON value when the initializer is a literal (an enum member gives its value).
 */
export type Element =
  | ({
      type: 'string';
      default?: string;
      /** Allowed values, from a string literal union (`"left" | "right"`). */
      enum?: string[];
      /** Values come from an exported enum: `@nanoforge-dev/input#InputEnum`. */
      enumRef?: string;
      enumMembers?: EnumMember[];
    } & ElementCommon)
  | ({
      type: 'number';
      default?: number;
      enumRef?: string;
      enumMembers?: EnumMember[];
    } & ElementCommon)
  | ({ type: 'boolean'; default?: boolean } & ElementCommon)
  | ({ type: 'asset'; default?: string; accept?: string[] } & ElementCommon)
  | ({ type: 'array'; items: Element; default?: unknown[] } & ElementCommon)
  | ({ type: 'object'; properties: Element[]; default?: Record<string, unknown> } & ElementCommon)
  | ({ type: 'ref'; ref: string } & ElementCommon)
  | ({ type: 'unknown'; tsType: string } & ElementCommon);

export type ElementType = Element['type'];

const EnumMemberSchema = z.object({ name: z.string(), value: z.union([z.string(), z.number()]) });

const elementBase = {
  name: z.string(),
  description: z.string().optional(),
  optional: z.boolean().optional(),
  deprecated: z.string().optional(),
  layout: ElementLayout.optional(),
  defaultCode: z.string().optional(),
};

export const Element: z.ZodType<Element> = z.lazy(() =>
  z.union([
    withOwners({
      ...elementBase,
      type: z.literal('string'),
      default: z.string().optional(),
      enum: z.array(z.string()).optional(),
      enumRef: ExportRef.optional(),
      enumMembers: z.array(EnumMemberSchema).optional(),
    }),
    withOwners({
      ...elementBase,
      type: z.literal('number'),
      default: z.number().optional(),
      enumRef: ExportRef.optional(),
      enumMembers: z.array(EnumMemberSchema).optional(),
    }),
    withOwners({ ...elementBase, type: z.literal('boolean'), default: z.boolean().optional() }),
    withOwners({
      ...elementBase,
      type: z.literal('asset'),
      default: z.string().optional(),
      accept: z.array(z.string().regex(/^\.[\w.]+$/)).optional(),
    }),
    withOwners({
      ...elementBase,
      type: z.literal('array'),
      items: Element,
      default: z.array(z.unknown()).optional(),
    }),
    withOwners({
      ...elementBase,
      type: z.literal('object'),
      properties: z.array(Element),
      default: z.record(z.string(), z.unknown()).optional(),
    }),
    withOwners({ ...elementBase, type: z.literal('ref'), ref: ExportRef }),
    withOwners({ ...elementBase, type: z.literal('unknown'), tsType: z.string() }),
  ]),
) as z.ZodType<Element>;

export const ItemKindSchema = z.enum(['class', 'function', 'const']);
