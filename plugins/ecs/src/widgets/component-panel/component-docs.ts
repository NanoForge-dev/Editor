import type { Element, ParamGroup } from '@nanoforge-dev/editor-sdk';

import { BUILT_IN_PRESETS } from '../../layout/param-layout';
import type { ParamDocs } from '../../model/item-docs.type';

/** A param's layout as its doc tags say it. */
export const docsOf = (element: Element): ParamDocs => {
  const layout = element.layout ?? {};
  return {
    ...(layout.label && { label: layout.label }),
    ...(layout.group && { group: layout.group }),
    ...(layout.preset && {
      preset: layout.preset.slot ? `${layout.preset.id}.${layout.preset.slot}` : layout.preset.id,
    }),
    ...(layout.color && { color: layout.color }),
    ...(layout.hidden && { hidden: true }),
  };
};

/** `Group N`, the first name no group has. */
export const nextGroupName = (groups: readonly ParamGroup[]): string => {
  let index = groups.length + 1;
  while (groups.some((group) => group.name === `Group ${index}`)) index += 1;
  return `Group ${index}`;
};

/** The docs of the params of a group, moved to another group (or to none). */
export const regrouped = (
  params: readonly Element[],
  group: string,
  to: string | undefined,
): Record<string, ParamDocs> => {
  const moved: Record<string, ParamDocs> = {};
  for (const element of params)
    if (element.layout?.group === group) {
      const docs = { ...docsOf(element) };
      if (to) docs.group = to;
      else delete (docs as { group?: string }).group;
      moved[element.name] = docs;
    }
  return moved;
};

/** A group with a change, without its empty fields. */
export const changedGroup = (group: ParamGroup, change: Partial<ParamGroup>): ParamGroup =>
  Object.fromEntries(
    Object.entries({ ...group, ...change }).filter(
      ([, value]) => value !== undefined && value !== '' && value !== false,
    ),
  ) as unknown as ParamGroup;

/** Slots of a preset still free in a group (plus the param's own). */
export const freeSlots = (
  params: readonly Element[],
  element: Element,
  presetId: string,
): string[] => {
  const definition = BUILT_IN_PRESETS.find(
    (preset) => preset.id === presetId && preset.slots && preset.types.includes(element.type),
  );
  if (!definition?.slots) return [];
  const taken = new Set(
    params
      .filter(
        (other) =>
          other !== element &&
          other.layout?.group === element.layout?.group &&
          other.layout?.preset?.id === presetId,
      )
      .map((other) => other.layout?.preset?.slot),
  );
  return definition.slots.filter((slot) => !taken.has(slot));
};

/** The `preset` doc of a param put in a preset: its first free slot, or the preset alone. */
export const presetDoc = (
  params: readonly Element[],
  element: Element,
  presetId: string,
): string | undefined => {
  const slots = freeSlots(params, element, presetId);
  const single = BUILT_IN_PRESETS.some(
    (preset) => preset.id === presetId && !preset.slots && preset.types.includes(element.type),
  );
  return slots.length ? `${presetId}.${slots[0]}` : single ? presetId : undefined;
};
