/**
 * The contribution keys the kit handles, for the JSON schema. Read by path (zod only): the kernel
 * does not depend on the kit.
 */
import { z } from 'zod';

import { IconFileSchema, IconThemeContributionSchema } from '../../ui/src/theme/icon-theme.schema';
import { ThemeContributionSchema } from '../../ui/src/theme/theme-contribution';

export const KIT_CONTRIBUTIONS: Record<string, z.ZodType> = {
  themes: z.array(ThemeContributionSchema),
  icons: z.array(IconFileSchema),
  iconThemes: z.array(IconThemeContributionSchema),
};
