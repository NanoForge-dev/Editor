import { z } from 'zod';

/**
 * Item metadata (ADR 0003): what the editor knows about each component, system or other item,
 * extracted from the TSDoc and the TypeScript of its source. Core fields never name a lib: lib
 * data lives in owner objects keyed by the owner plugin's registry name (`"@nanoforge/ecs": {…}`).
 */

/** A package or plugin of our registry: `@scope/name`. Also the key of an owner object. */
export const REGISTRY_NAME = /^@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;
export const RegistryName = z.string().regex(REGISTRY_NAME);

/** An npm package name: `@scope/name` or `name`. */
export const NpmName = z.string().regex(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/);

/** An export of a module: `@nanoforge-dev/graphics-2d#Rect`, or `apps/client/src/x.ts#Foo`. */
export const ExportRef = z.string().regex(/^[^#\s]+#[A-Za-z_$][\w$]*$/);

/**
 * An item: `<source>#<export>`. The source is an installed package or a shared library
 * (`@nanoforge/motion#Position`, `@pong-network/shared#Player`), or an app (`app:client#Paddle`).
 */
export const ItemRef = z
  .string()
  .regex(/^(app:[\w.-]+|(@[a-z0-9-~][\w.-]*\/)?[a-z0-9-~][\w.-]*)#[A-Za-z_$][\w$]*$/);
export type ItemRef = z.output<typeof ItemRef>;

export const itemRef = (source: string, exportName: string): ItemRef => `${source}#${exportName}`;

/** Where an item runs. A NanoForge app concept (client and server apps), so it's core. */
export const Side = z.enum(['client', 'server', 'shared']);
export type Side = z.output<typeof Side>;
