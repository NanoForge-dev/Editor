import type { MergeStrategy } from '../definition/setting-definition.type';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const deepMerge = (base: unknown, override: unknown): unknown => {
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) result[key] = deepMerge(base[key], value);
  return result;
};

export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => deepEqual(value, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => key in b && deepEqual(a[key], b[key]))
    );
  }
  return false;
};

/** Combines values from lowest to highest precedence according to the merge strategy. */
export const combine = (strategy: MergeStrategy, values: readonly unknown[]): unknown => {
  if (!values.length) return undefined;
  switch (strategy) {
    case 'replace':
      return values.at(-1);
    case 'deep':
      return values.reduce((merged, value) => deepMerge(merged, value));
    case 'union': {
      const result: unknown[] = [];
      for (const value of values) {
        if (!Array.isArray(value)) return values.at(-1);
        for (const item of value)
          if (!result.some((existing) => deepEqual(existing, item))) result.push(item);
      }
      return result;
    }
  }
};
