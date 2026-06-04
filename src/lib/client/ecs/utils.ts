import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import { formatFrom } from '@utils/format';
import { randomString } from '@utils/string';

export const resetSubscriptions = (store: Writable<Record<string, Unsubscriber | null>>) => {
  const subscriptions = get(store);
  Object.values(subscriptions).forEach((sub) => {
    try {
      sub?.();
    } catch {
      /* empty */
    }
  });
  store.set({});
};

export const resetListeners = (store: Writable<Unsubscriber[] | null>) => {
  const listeners = get(store);
  listeners?.forEach((sub) => {
    try {
      sub();
    } catch {
      /* empty */
    }
  });
  store.set(null);
};

export const resolveStore = <T>(
  storage: Writable<Record<string, Writable<T>>>,
  resolvable: string,
  defaultValue?: T,
) => {
  const content = get(storage);
  if (resolvable in content) return content[resolvable];
  content[resolvable] = writable(defaultValue);
  storage.set(content);
  return content[resolvable];
};

export const getId = (data: { id: string }[], name: string): string => {
  const baseId = formatFrom.all(name).toSnake();
  let id = baseId;
  while (data.find((d) => d.id === id)) {
    id = `${baseId}_${randomString(5)}`;
  }
  return id;
};
