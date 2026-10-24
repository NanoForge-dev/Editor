import { z } from 'zod';

export const Ref = z.object({ instanceId: z.string().min(1), widgetId: z.string().min(1) });
export const Stack = z.object({
  tabs: z.array(Ref).catch([]),
  active: z.string().nullable().catch(null),
});
export const Slot = z.object({
  visible: z.boolean().catch(true),
  size: z.number().catch(260),
  stack: Stack.catch({ tabs: [], active: null }),
});
export const Float = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  z: z.number().catch(1),
  stack: Stack,
});
