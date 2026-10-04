/** `a/./b/../c` → `a/c`, without a leading `./`. */
export const joinPosix = (base: string, target: string): string => {
  const parts: string[] = [];
  for (const part of `${base}/${target}`.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
};

/** Whether a module matches a `paths` pattern (`@me/shared/*`). */
export const matchesPathPattern = (pattern: string, module: string): boolean => {
  const star = pattern.indexOf('*');
  if (star < 0) return pattern === module;
  return module.startsWith(pattern.slice(0, star)) && module.endsWith(pattern.slice(star + 1));
};

const withoutExtension = (path: string) =>
  path.replace(/(\.d)?\.[cm]?[jt]sx?$/, '').replace(/\/index$/, '');

/** Import specifier of `target` from `from` (project paths), through `paths` when one maps it. */
export const moduleSpecifierFor = (
  from: string,
  target: string,
  paths: Readonly<Record<string, readonly string[]>>,
): string => {
  const bare = withoutExtension(target);
  for (const [pattern, targets] of Object.entries(paths)) {
    for (const mapped of targets) {
      const star = mapped.indexOf('*');
      const patternStar = pattern.indexOf('*');
      if (star < 0 || patternStar < 0) {
        if (withoutExtension(mapped) === bare) return pattern;
        continue;
      }
      const prefix = mapped.slice(0, star);
      const suffix = withoutExtension(mapped.slice(star + 1));
      if (!bare.startsWith(prefix) || !bare.endsWith(suffix)) continue;
      const middle = bare.slice(prefix.length, bare.length - suffix.length);
      return pattern.slice(0, patternStar) + middle + pattern.slice(patternStar + 1);
    }
  }
  const fromParts = from.split('/').slice(0, -1);
  const toParts = bare.split('/');
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  )
    common++;
  const up = fromParts.length - common;
  const relative = [...Array<string>(up).fill('..'), ...toParts.slice(common)].join('/');
  return up === 0 ? `./${relative}` : relative;
};
