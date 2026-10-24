import { z } from 'zod';

export const SettingValues = z.record(z.string(), z.unknown());

/** The account settings document. `revision` is opaque (null before the first save). */
export const AccountSettingsDocument = z.object({
  revision: z.string().nullable(),
  values: SettingValues,
});
export type AccountSettingsDocument = z.output<typeof AccountSettingsDocument>;

/** Limits of a settings document (also enforced by the NanoForge API). */
export const SETTINGS_LIMITS = { maxBytes: 256 * 1024, maxKeys: 2000 } as const;
