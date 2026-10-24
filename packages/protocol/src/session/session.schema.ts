import { z } from 'zod';

export const EditorMode = z.enum(['OFFLINE', 'ONLINE']);
export type EditorMode = z.output<typeof EditorMode>;

export const User = z.object({ id: z.string(), name: z.string(), email: z.string().optional() });
export type User = z.output<typeof User>;

export const SessionInfo = z.object({
  mode: EditorMode,
  version: z.string(),
  /** Null when ONLINE and not signed in on the NanoForge website. */
  user: User.nullable(),
  /** ONLINE: where to sign in (the NanoForge projects website sets the auth cookies). */
  loginUrl: z.string().nullable(),
  /**
   * What the services behind the editor offer: `settings` (account settings sync between
   * machines; without it a hosted editor keeps them on its own disk), `registry` (the registry
   * of plugins and packages answers).
   */
  features: z.array(z.enum(['settings', 'registry'])).default([]),
});
export type SessionInfo = z.output<typeof SessionInfo>;
