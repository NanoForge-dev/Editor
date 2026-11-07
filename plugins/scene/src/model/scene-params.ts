import type { SceneParam } from './scene-model.type';

/** A param's value from a prompt's text: by its type, else JSON, else the text itself. */
export const parseParam = (param: Pick<SceneParam, 'type'>, text: string): unknown => {
  const type = param.type.trim();
  if (type === 'number') return Number(text);
  if (type === 'boolean') return text.trim() === 'true';
  if (type === 'string') return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/** A live value as one line (the engine's JSON view: class instances carry `$class`). */
export const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return JSON.stringify(value);
  const text = JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
};
