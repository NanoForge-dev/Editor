import { type FileEntry, matchesGlob } from '@nanoforge-dev/editor-sdk';
import type { FileIcon } from '@nanoforge-dev/editor-sdk/ui';

/**
 * The icon of a file or folder: the matching contribution of the highest priority (folders match
 * only `folder` ones, with `iconOpen` while expanded), else `file`, `folder` or `folder-open`.
 */
export const iconOfEntry = (
  icons: readonly FileIcon[],
  entry: Pick<FileEntry, 'path' | 'kind'>,
  expanded = false,
): string => {
  const folder = entry.kind === 'directory';
  const icon = icons
    .filter(
      (candidate) => !!candidate.folder === folder && matchesGlob(candidate.pattern, entry.path),
    )
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  if (!folder) return icon?.icon ?? 'file';
  return (
    (expanded ? icon?.iconOpen : undefined) ?? icon?.icon ?? (expanded ? 'folder-open' : 'folder')
  );
};
