import { z } from 'zod';

import { type ExtensionPoint, defineExtensionPoint } from '@nanoforge-dev/editor-kernel';

/** What a step points at: an element found by role and accessible name, as tests find them. */
export const TourTargetSchema = z.object({
  role: z.string().min(1),
  name: z.string().min(1),
  /** False: the name only starts with `name` (a tree row says more than its label). */
  exact: z.boolean().default(true),
  /** Inside the element of this role and name (a panel, a list). */
  within: z.object({ role: z.string().min(1), name: z.string().min(1) }).optional(),
});
export type TourTarget = z.output<typeof TourTargetSchema>;

export const TourStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  target: TourTargetSchema.optional(),
  /** Shown only while true (`when` clause): steps that need a local editor, a project… */
  when: z.string().optional(),
  /** Goes to the next step by itself once true (`when` clause). */
  advanceWhen: z.string().optional(),
  /** Goes to the next step by itself once this context key's value changes. */
  advanceWhenChanged: z.string().optional(),
  /** A button of the step that runs a command (Open the Scenes panel…). */
  action: z
    .object({
      title: z.string().min(1),
      command: z.string().min(1),
      args: z.array(z.unknown()).default([]),
    })
    .optional(),
});
export type TourStep = z.output<typeof TourStepSchema>;

/** A guided tour: steps shown one at a time over the editor (`contributes.tours`). */
export const TourSchema = z.object({
  id: z.string().regex(/^[a-z0-9][\w.-]*$/),
  title: z.string().min(1),
  steps: z.array(TourStepSchema).min(1),
});
export type Tour = z.output<typeof TourSchema>;

export const TOURS: ExtensionPoint<Tour> = defineExtensionPoint('ui.tours', {
  validator: TourSchema as unknown as z.ZodType<Tour>,
});
