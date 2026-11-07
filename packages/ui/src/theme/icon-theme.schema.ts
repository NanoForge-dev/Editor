import { z } from 'zod';

/** An icon contributed as a file: `{ "id": "rocket", "path": "icons/rocket.svg" }`. */
export const IconFileSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][\w-]*$/),
  path: z.string().min(1),
});

/**
 * An icon theme as contributed (`contributes.iconThemes`): icons by name (any icon of the editor:
 * panels, stripes, menus, files), and file and folder icons by pattern. Paths are SVG files of
 * the plugin.
 */
export const IconThemeContributionSchema = z.strictObject({
  id: z.string().regex(/^[\w-]+$/),
  label: z.string().min(1),
  icons: z.record(z.string().regex(/^[a-z0-9][\w-]*$/), z.string().min(1)).default({}),
  files: z
    .array(z.strictObject({ pattern: z.string().min(1), icon: z.string().min(1) }))
    .default([]),
  folders: z
    .array(
      z.strictObject({
        pattern: z.string().min(1),
        icon: z.string().min(1),
        iconOpen: z.string().min(1).optional(),
      }),
    )
    .default([]),
});
export type IconThemeContribution = z.output<typeof IconThemeContributionSchema>;
