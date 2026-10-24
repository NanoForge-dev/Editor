import {
  type ExtensionPoint,
  type Observable,
  defineExtensionPoint,
} from '@nanoforge-dev/editor-kernel';

/** A file created from a template: path relative to the target folder. */
export interface TemplateFile {
  readonly path: string;
  readonly content: string | Uint8Array;
}

/** "New …" entries of the file manager (and other creation UIs). */
export interface FileTemplate {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
  /** Groups templates in the New menu (`Code`, `ECS`…). */
  readonly category?: string;
  /** Offered only when true (context keys: `fileFolder`, `appType`…). */
  readonly when?: string;
  /** Name proposed to the user, extension included (`NewComponent.ts`). */
  readonly defaultName: string;
  /** Files to create for the chosen `name` in `folder` (the first one is opened). */
  create(context: {
    folder: string;
    name: string;
  }): readonly TemplateFile[] | Promise<readonly TemplateFile[]>;
}

export const FILE_TEMPLATES: ExtensionPoint<FileTemplate> =
  defineExtensionPoint<FileTemplate>('ui.fileTemplates');

/**
 * Context menu entries of files and folders. The command receives the selected paths. `when`
 * sees `fileKind` (`file`/`directory`), `fileExtname` (`.ts`), `fileReadOnly` and
 * `fileSelectionCount`.
 */
export interface FileAction {
  readonly id: string;
  readonly title: string;
  readonly command: string;
  readonly icon?: string;
  /** Actions are grouped (separated) by group, then sorted by order. */
  readonly group?: string;
  readonly order?: number;
  readonly when?: string;
}

export const FILE_ACTIONS: ExtensionPoint<FileAction> =
  defineExtensionPoint<FileAction>('ui.fileActions');

/** Icon of files matching a glob (`**\/*.png`); the highest priority wins. */
export interface FileIcon {
  readonly pattern: string;
  readonly icon: string;
  readonly priority?: number;
}

export const FILE_ICONS: ExtensionPoint<FileIcon> = defineExtensionPoint<FileIcon>('ui.fileIcons');

/** A mark on a file or folder of the Files panel: a short badge after its name, colored. */
export interface FileDecoration {
  /** One or two characters (`M`, `U`…). */
  readonly badge: string;
  readonly tone?: 'modified' | 'added' | 'deleted' | 'conflict';
  readonly tooltip?: string;
}

/** Marks files (their version control status…). The first provider with an answer wins. */
export interface FileDecorationProvider {
  readonly id: string;
  /** Fires when `decorate` may give other answers. */
  readonly changes: Observable<unknown>;
  decorate(path: string, kind: 'file' | 'directory'): FileDecoration | undefined;
}

export const FILE_DECORATIONS: ExtensionPoint<FileDecorationProvider> =
  defineExtensionPoint<FileDecorationProvider>('ui.fileDecorations');
