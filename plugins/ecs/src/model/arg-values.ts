/** Values of component params: what an argument holds, and what to write for a new value. */
import type { Element } from '@nanoforge-dev/editor-sdk';

import type { ArgModel, ArgValue, ImportNeed } from './ecs-model.type';

/** The value a field shows: the argument's, else the param's default. */
export const currentValue = (element: Element, arg: ArgModel | undefined): unknown =>
  arg ? (arg.value ?? undefined) : 'default' in element ? element.default : undefined;

/** The argument to write when a param has no argument yet (filling earlier positions). */
export const defaultArg = (element: Element): ArgValue => {
  if ('default' in element && element.default !== undefined) return { value: element.default };
  if (element.defaultCode) return { code: element.defaultCode };
  if (element.optional) return { code: 'undefined' };
  switch (element.type) {
    case 'number':
      return { value: 0 };
    case 'boolean':
      return { value: false };
    case 'string':
    case 'asset':
      return { value: element.type === 'string' && element.enum?.[0] ? element.enum[0] : '' };
    case 'array':
      return { value: [] };
    default:
      return { code: 'undefined' };
  }
};

/** Arguments of a new component: every param up to the last one without a default. */
export const initialArgs = (params: readonly Element[]): ArgValue[] => {
  let last = -1;
  params.forEach((param, index) => {
    if (!param.optional) last = index;
  });
  return params.slice(0, last + 1).map(defaultArg);
};

/** `@nanoforge-dev/input#InputEnum` → the enum's name and module. */
export const splitRef = (ref: string): { module: string; name: string } => {
  const index = ref.lastIndexOf('#');
  return { module: ref.slice(0, index), name: ref.slice(index + 1) };
};

/** An enum member's code (`InputEnum.ArrowUp`) and the import it needs. */
export const enumMemberArg = (
  enumRef: string,
  member: string,
): { value: ArgValue; imports: ImportNeed[] } => {
  const { module, name } = splitRef(enumRef);
  return { value: { code: `${name}.${member}` }, imports: [{ name, from: module }] };
};

/** `#rrggbb` of a color string, when it is one. */
export const hexColor = (value: unknown): string | undefined =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;

const hex = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');

export const rgbToHex = (r: number, g: number, b: number): string => `#${hex(r)}${hex(g)}${hex(b)}`;

export const hexToRgb = (value: string): [number, number, number] => [
  Number.parseInt(value.slice(1, 3), 16),
  Number.parseInt(value.slice(3, 5), 16),
  Number.parseInt(value.slice(5, 7), 16),
];
