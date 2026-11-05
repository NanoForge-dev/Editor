import type { FileEntry } from '@nanoforge-dev/editor-sdk';

/**
 * The assets of an app as its game loads them: the build copies the assets folder to the root
 * of its output, so `<assets>/textures/hero.png` is `/textures/hero.png`. `accept` keeps the
 * extensions an `@asset` param takes (`.png .jpg`); none keeps every file.
 */
export const assetPaths = (
  entries: readonly Pick<FileEntry, 'path' | 'kind'>[],
  assetsDir: string,
  accept: readonly string[] = [],
): string[] => {
  const prefix = assetsDir ? `${assetsDir}/` : '';
  const extensions = accept.map((extension) => extension.toLowerCase());
  return entries
    .filter(
      (entry) =>
        entry.kind === 'file' &&
        entry.path.startsWith(prefix) &&
        (!extensions.length ||
          extensions.some((extension) => entry.path.toLowerCase().endsWith(extension))),
    )
    .map((entry) => `/${entry.path.slice(prefix.length)}`)
    .sort();
};
