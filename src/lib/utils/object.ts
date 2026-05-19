import { isNullish } from '@utils/null';

export const cloneDeep = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

type AssignType<T extends object, V> = {
  [K in keyof T]: T[K] extends object ? AssignType<T[K], V> : V;
};

export const assignDeep = <T extends Record<any, any>, V>(obj: T, value: V): AssignType<T, V> => {
  const copy: any = {};
  for (const key in obj) {
    copy[key] =
      !isNullish(obj[key]) && typeof obj[key] === 'object' ? assignDeep(obj[key], value) : value;
  }
  return copy;
};

export const flatObjectValues = (object: any): any[] => {
  let results: any[] = [];

  for (const value of Object.values(object)) {
    const values = typeof value === 'object' ? flatObjectValues(value) : [value];
    results = [...results, ...values];
  }

  return results;
};
