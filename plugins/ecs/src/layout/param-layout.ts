/**
 * How a component's params are laid out in the inspector (spec: "Param layout"): groups,
 * presets that merge params into one control, labels, colors, and what's hidden.
 */
import type { Element, ParamGroup } from '@nanoforge-dev/editor-sdk';

export interface PresetDefinition {
  readonly id: string;
  readonly title: string;
  /** Slots the params fill, in display order. Absent: a one-param preset. */
  readonly slots?: readonly string[];
  /** Slots that must all be filled. */
  readonly required?: readonly string[];
  /** Least number of slots filled (e.g. a vector needs 2). */
  readonly minimum?: number;
  /** Element types a param must have to use it. */
  readonly types: readonly Element['type'][];
}

export const BUILT_IN_PRESETS: readonly PresetDefinition[] = [
  {
    id: 'vector',
    title: 'Vector',
    slots: ['x', 'y', 'z', 'w'],
    required: ['x', 'y'],
    minimum: 2,
    types: ['number'],
  },
  {
    id: 'size',
    title: 'Size',
    slots: ['width', 'height'],
    required: ['width', 'height'],
    types: ['number'],
  },
  { id: 'color', title: 'Color', types: ['string'] },
  {
    id: 'color',
    title: 'Color',
    slots: ['r', 'g', 'b', 'a'],
    required: ['r', 'g', 'b'],
    types: ['number'],
  },
];

export interface ParamRow {
  readonly kind: 'param';
  readonly index: number;
  readonly element: Element;
  readonly label: string;
  readonly color?: string;
  /** A one-param preset (a color picker). */
  readonly preset?: string;
  readonly hidden: boolean;
}

export interface PresetRow {
  readonly kind: 'preset';
  readonly preset: PresetDefinition;
  readonly label: string;
  readonly slots: readonly {
    readonly slot: string;
    readonly index: number;
    readonly element: Element;
  }[];
  readonly hidden: boolean;
}

export type LayoutRow = ParamRow | PresetRow;

export interface GroupBlock {
  readonly kind: 'group';
  readonly group: ParamGroup;
  readonly rows: readonly LayoutRow[];
  readonly hidden: boolean;
}

export type LayoutBlock = LayoutRow | GroupBlock;

export interface HiddenEntry {
  /** `param:<name>` or `group:<name>`. */
  readonly id: string;
  readonly label: string;
}

export interface ParamLayout {
  readonly blocks: readonly LayoutBlock[];
  /** What is hidden now (for the "Show hidden" menu). */
  readonly hidden: readonly HiddenEntry[];
  readonly warnings: readonly string[];
}

export const paramLabel = (element: Element): string => element.layout?.label ?? element.name;

const presetFor = (
  presets: readonly PresetDefinition[],
  id: string,
  element: Element,
  slotted: boolean,
): PresetDefinition | undefined =>
  presets.find(
    (preset) =>
      preset.id === id && !!preset.slots === slotted && preset.types.includes(element.type),
  );

/**
 * The blocks of a component's params. `shown` holds the ids (`param:x`, `group:Debug`) the user
 * chose to show although they are hidden.
 */
export const buildLayout = (
  params: readonly Element[],
  groups: readonly ParamGroup[],
  shown: ReadonlySet<string> = new Set(),
  presets: readonly PresetDefinition[] = BUILT_IN_PRESETS,
): ParamLayout => {
  const warnings: string[] = [];
  const groupOf = new Map(groups.map((group) => [group.name, group]));
  const isHidden = (id: string, flag: boolean | undefined) => !!flag && !shown.has(id);

  const members = new Map<string, { index: number; element: Element }[]>();
  params.forEach((element, index) => {
    const key = element.layout?.group ?? '';
    if (!members.has(key)) members.set(key, []);
    members.get(key)!.push({ index, element });
  });

  const rowsOf = (
    list: readonly { index: number; element: Element }[],
    groupName: string,
  ): LayoutRow[] => {
    const slotted = new Map<string, { slot: string; index: number; element: Element }[]>();
    for (const { index, element } of list) {
      const preset = element.layout?.preset;
      if (preset?.slot) {
        const entries = slotted.get(preset.id) ?? [];
        entries.push({ slot: preset.slot, index, element });
        slotted.set(preset.id, entries);
      }
    }
    const valid = new Map<string, { definition: PresetDefinition; entries: typeof list }>();
    for (const [id, entries] of slotted) {
      const definition = presetFor(presets, id, entries[0]!.element, true);
      const names = entries.map((entry) => entry.slot);
      const problem = !definition
        ? `Unknown preset "${id}" for ${entries.map((entry) => entry.element.name).join(', ')}.`
        : entries.some((entry) => !definition.types.includes(entry.element.type))
          ? `The preset "${id}" needs ${definition.types.join(' or ')} params.`
          : names.some((name) => !definition.slots!.includes(name))
            ? `The preset "${id}" has no slot "${names.find((name) => !definition.slots!.includes(name))}" (slots: ${definition.slots!.join(', ')}).`
            : new Set(names).size !== names.length
              ? `Two params use the same slot of the preset "${id}".`
              : (definition.required ?? []).some((slot) => !names.includes(slot)) ||
                  names.length < (definition.minimum ?? 1)
                ? `The preset "${id}" needs the slots ${(definition.required ?? []).join(', ')}.`
                : undefined;
      if (problem) warnings.push(groupName ? `${groupName}: ${problem}` : problem);
      else valid.set(id, { definition: definition!, entries });
    }

    const rows: LayoutRow[] = [];
    const placed = new Set<string>();
    for (const { index, element } of list) {
      const preset = element.layout?.preset;
      if (preset?.slot && valid.has(preset.id)) {
        if (placed.has(preset.id)) continue;
        placed.add(preset.id);
        const { definition, entries } = valid.get(preset.id)!;
        const slots = definition
          .slots!.map((slot) => {
            const entry = entries.find(
              (candidate) => candidate.element.layout?.preset?.slot === slot,
            );
            return entry && { slot, index: entry.index, element: entry.element };
          })
          .filter((entry): entry is NonNullable<typeof entry> => !!entry);
        rows.push({
          kind: 'preset',
          preset: definition,
          label: groupName || definition.title,
          slots,
          hidden: slots.every((slot) =>
            isHidden(`param:${slot.element.name}`, slot.element.layout?.hidden),
          ),
        });
        continue;
      }
      const single =
        preset && !preset.slot ? presetFor(presets, preset.id, element, false) : undefined;
      if (preset && !preset.slot && !single)
        warnings.push(`The preset "${preset.id}" doesn't fit ${element.name} (${element.type}).`);
      rows.push({
        kind: 'param',
        index,
        element,
        label: paramLabel(element),
        ...(element.layout?.color && { color: element.layout.color }),
        ...(single && { preset: single.id }),
        hidden: isHidden(`param:${element.name}`, element.layout?.hidden),
      });
    }
    return rows;
  };

  const loose = new Map<number, LayoutRow>();
  for (const row of rowsOf(members.get('') ?? [], ''))
    loose.set(
      row.kind === 'param' ? row.index : Math.min(...row.slots.map((slot) => slot.index)),
      row,
    );
  const blocks: LayoutBlock[] = [];
  const emitted = new Set<string>();
  params.forEach((element, index) => {
    const key = element.layout?.group ?? '';
    if (!key) {
      const row = loose.get(index);
      if (row) blocks.push(row);
      return;
    }
    if (emitted.has(key)) return;
    emitted.add(key);
    const group = groupOf.get(key) ?? { name: key };
    blocks.push({
      kind: 'group',
      group,
      rows: rowsOf(members.get(key)!, key),
      hidden: isHidden(`group:${key}`, group.hidden),
    });
  });

  const hidden: HiddenEntry[] = [];
  for (const block of blocks) {
    if (block.kind === 'group') {
      if (block.hidden) hidden.push({ id: `group:${block.group.name}`, label: block.group.name });
      else
        for (const row of block.rows)
          if (row.kind === 'param' && row.hidden)
            hidden.push({ id: `param:${row.element.name}`, label: row.label });
    } else if (block.kind === 'param' && block.hidden) {
      hidden.push({ id: `param:${block.element.name}`, label: block.label });
    }
  }
  return { blocks, hidden, warnings };
};
