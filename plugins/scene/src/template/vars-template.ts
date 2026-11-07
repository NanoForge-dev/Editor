/** A new `scene-vars.ts`, with its first var. */
export const varsTemplate = (
  name: string,
  type: string,
  description: string | undefined,
  fallback: string | undefined,
): string => {
  const doc = [description?.trim(), fallback?.trim() ? `@default ${fallback.trim()}` : '']
    .filter(Boolean)
    .join(' ');
  return [
    '/**',
    ' * The scene vars of the game. A var belongs to the scene that made it, and goes away when that',
    ' * scene is unloaded, unless it is persistent.',
    ' */',
    'declare module "@nanoforge-dev/scene" {',
    '  interface SceneVars {',
    ...(doc ? [`    /** ${doc} */`] : []),
    `    ${name}: ${type};`,
    '  }',
    '}',
    '',
    'export {};',
    '',
  ].join('\n');
};
