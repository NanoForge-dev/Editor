import { pushRecent } from './palette-model';

const KEY = 'nanoforge.command-palette.recent';

/** Actions run last from the palette, kept in this browser. */
export const readRecent = (storage: Pick<Storage, 'getItem'> = localStorage): string[] => {
  try {
    const value: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export const rememberRecent = (
  id: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): void => {
  try {
    storage.setItem(KEY, JSON.stringify(pushRecent(readRecent(storage), id)));
  } catch {}
};
