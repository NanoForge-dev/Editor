import type {
  ClientProject,
  CodeService,
  DiagnosticsService,
  DocumentService,
  Logger,
  SettingsService,
} from '@nanoforge-dev/editor-sdk';
import type { NotificationService } from '@nanoforge-dev/editor-sdk/ui';

import type { Monaco } from '../monaco/monaco';

export interface EditorGroup {
  readonly tabs: readonly string[];
  readonly active: string | undefined;
}

export interface EditorLayout {
  /** One group, or two side by side. */
  readonly groups: readonly EditorGroup[];
  readonly focused: number;
}

/** A text a file is compared with, and what it is ("Last commit"). */
export interface Comparison {
  readonly text: string;
  readonly label: string;
}

export interface OpenOptions {
  readonly line?: number;
  readonly column?: number;
  readonly group?: number;
  /** A side panel to show next to the file (`ecs.component`), opened even if it was closed. */
  readonly sidePanel?: string;
}

/** Where to show a position in a group (consumed by the group's editor). */
export interface Reveal {
  readonly group: number;
  readonly path: string;
  readonly line: number;
  readonly column: number;
}

export interface CodeEditorServiceOptions {
  readonly monaco: Monaco;
  readonly project: ClientProject;
  readonly documents: DocumentService;
  readonly code: CodeService | undefined;
  readonly diagnostics: DiagnosticsService | undefined;
  readonly settings: SettingsService;
  readonly notifications: NotificationService | undefined;
  readonly logger: Logger;
  /** Runs an editor command (the empty screen offers Go to file). */
  readonly runCommand?: (id: string) => void;
}
