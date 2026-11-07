import type { SettingValues } from './scope-store.type';

export const applyPatch = (
  values: SettingValues,
  patch: SettingValues,
): Record<string, unknown> => {
  const next = new Map(Object.entries(values));
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) next.delete(key);
    else next.set(key, value);
  }
  return Object.fromEntries(next);
};

/** Sorted keys, 2-space JSON: stable diffs for files committed with the project. */
export const serializeValues = (values: SettingValues): string =>
  `${JSON.stringify(
    Object.fromEntries(
      Object.keys(values)
        .sort()
        .map((key) => [key, values[key]]),
    ),
    null,
    2,
  )}\n`;
