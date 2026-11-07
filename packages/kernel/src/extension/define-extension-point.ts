import type { ExtensionPoint, ExtensionPointOptions } from './extension-point.type';

/** Declares an extension point other plugins can contribute to. */
export const defineExtensionPoint = <T>(
  id: string,
  options: ExtensionPointOptions<T> = {},
): ExtensionPoint<T> =>
  Object.freeze({ id, validator: options.validator, multiple: options.multiple ?? true });
