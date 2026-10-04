import type { LogValue } from './log-value.type';

const isPlain = (value: LogValue): value is string | number | boolean | null =>
  value === null || typeof value !== 'object';

/**
 * One-line text of a logged value, as a console prints it: top-level strings are bare, nested
 * ones quoted.
 */
export const formatLogValue = (value: LogValue, nested = false): string => {
  if (isPlain(value))
    return typeof value === 'string' && nested ? JSON.stringify(value) : `${value}`;
  switch (value.type) {
    case 'undefined':
      return 'undefined';
    case 'number':
    case 'bigint':
    case 'symbol':
    case 'function':
    case 'date':
    case 'cut':
      return value.text;
    case 'circular':
      return '[Circular]';
    case 'error':
      return nested || !value.stack ? `${value.name}: ${value.message}` : value.stack;
    case 'array': {
      const items = value.items.map((item) => formatLogValue(item, true));
      if (value.more) items.push(`… ${value.more} more`);
      const prefix = value.name ? `${value.name}(${value.length}) ` : '';
      return `${prefix}[${items.join(', ')}]`;
    }
    case 'map': {
      const entries = value.entries.map(
        ([key, item]) => `${formatLogValue(key, true)} => ${formatLogValue(item, true)}`,
      );
      if (value.more) entries.push(`… ${value.more} more`);
      return `Map(${value.size}) {${entries.join(', ')}}`;
    }
    case 'object': {
      const entries = value.entries.map(([key, item]) => `${key}: ${formatLogValue(item, true)}`);
      if (value.more) entries.push(`… ${value.more} more`);
      const body = entries.length ? `{ ${entries.join(', ')} }` : '{}';
      return value.name ? `${value.name} ${body}` : body;
    }
  }
};

/** Whether a value has children to expand. */
export const isExpandableLogValue = (value: LogValue): boolean =>
  !isPlain(value) &&
  ((value.type === 'object' && value.entries.length > 0) ||
    (value.type === 'array' && value.items.length > 0) ||
    (value.type === 'map' && value.entries.length > 0) ||
    (value.type === 'error' && !!value.stack));
