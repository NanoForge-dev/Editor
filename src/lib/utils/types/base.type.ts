export type WithOptional<T, K extends keyof T | never = never> = Omit<T, K> & Partial<Pick<T, K>>;
