import type { LogValue, LogValueLimits } from './log-value.type';

const constructorName = (value: object): string | undefined => {
  try {
    const name = (Object.getPrototypeOf(value) as { constructor?: { name?: unknown } } | null)
      ?.constructor?.name;
    return typeof name === 'string' && name && name !== 'Object' ? name : undefined;
  } catch {
    return undefined;
  }
};

const summary = (value: object): string => {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value instanceof Map) return `Map(${value.size})`;
  if (value instanceof Set) return `Set(${value.size})`;
  return constructorName(value) ?? 'Object';
};

/** Snapshot of a value for the console, within limits (never throws). */
export const serializeLogValue = (input: unknown, limits: LogValueLimits = {}): LogValue => {
  const maxDepth = limits.depth ?? 4;
  const maxEntries = limits.entries ?? 50;
  const maxText = limits.text ?? 10_000;
  let budget = limits.nodes ?? 500;
  const ancestors = new Set<object>();

  const text = (value: string) => (value.length > maxText ? `${value.slice(0, maxText)}…` : value);

  const visit = (value: unknown, depth: number): LogValue => {
    budget--;
    switch (typeof value) {
      case 'string':
        return text(value);
      case 'boolean':
        return value;
      case 'number':
        return Number.isFinite(value) && !Object.is(value, -0)
          ? value
          : { type: 'number', text: Object.is(value, -0) ? '-0' : String(value) };
      case 'undefined':
        return { type: 'undefined' };
      case 'bigint':
        return { type: 'bigint', text: `${value}n` };
      case 'symbol':
        return { type: 'symbol', text: String(value) };
      case 'function':
        return { type: 'function', text: value.name ? `ƒ ${value.name}()` : 'ƒ ()' };
    }
    if (value === null) return null;
    const object = value as object;
    if (ancestors.has(object)) return { type: 'circular' };
    try {
      if (object instanceof Error) {
        return {
          type: 'error',
          name: object.name,
          message: text(object.message),
          ...(object.stack && { stack: text(object.stack) }),
        };
      }
      if (object instanceof Date) {
        return {
          type: 'date',
          text: Number.isNaN(object.getTime()) ? 'Invalid Date' : object.toISOString(),
        };
      }
      if (depth >= maxDepth || budget <= 0) return { type: 'cut', text: summary(object) };
      ancestors.add(object);
      try {
        if (object instanceof Map) {
          const entries: [LogValue, LogValue][] = [];
          for (const [key, item] of object) {
            if (entries.length >= maxEntries || budget <= 0) break;
            entries.push([visit(key, depth + 1), visit(item, depth + 1)]);
          }
          const more = object.size - entries.length;
          return { type: 'map', size: object.size, entries, ...(more > 0 && { more }) };
        }
        const list = Array.isArray(object)
          ? (object as unknown[])
          : object instanceof Set
            ? [...(object as Set<unknown>)]
            : ArrayBuffer.isView(object) && !(object instanceof DataView)
              ? (object as unknown as ArrayLike<unknown>)
              : undefined;
        if (list) {
          const items: LogValue[] = [];
          for (let index = 0; index < list.length; index++) {
            if (items.length >= maxEntries || budget <= 0) break;
            items.push(visit(list[index], depth + 1));
          }
          const more = list.length - items.length;
          return {
            type: 'array',
            ...(!Array.isArray(object) && { name: constructorName(object) ?? 'Array' }),
            length: list.length,
            items,
            ...(more > 0 && { more }),
          };
        }
        const keys = Object.keys(object);
        const entries: [string, LogValue][] = [];
        for (const key of keys) {
          if (entries.length >= maxEntries || budget <= 0) break;
          let item: unknown;
          try {
            item = (object as Record<string, unknown>)[key];
          } catch (error) {
            item = `[threw ${String(error)}]`;
          }
          entries.push([key, visit(item, depth + 1)]);
        }
        const name = constructorName(object);
        const more = keys.length - entries.length;
        return { type: 'object', ...(name && { name }), entries, ...(more > 0 && { more }) };
      } finally {
        ancestors.delete(object);
      }
    } catch {
      return { type: 'cut', text: 'Object' };
    }
  };
  return visit(input, 0);
};
