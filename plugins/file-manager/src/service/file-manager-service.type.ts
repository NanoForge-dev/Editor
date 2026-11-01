import type {
  ClientProject,
  ContextKeyService,
  ExtensionPoint,
  HistoryContext,
  Logger,
} from '@nanoforge-dev/editor-sdk';
import type { NotificationService, PromptService } from '@nanoforge-dev/editor-sdk/ui';

export interface Clipboard {
  readonly mode: 'copy' | 'cut';
  readonly paths: readonly string[];
}

/** The part of the extension registry the file manager reads. */
export interface Contributions {
  getValues<T>(point: ExtensionPoint<T>): T[];
}

export interface FileManagerServiceOptions {
  readonly project: ClientProject;
  readonly history: HistoryContext;
  readonly extensions: Contributions;
  /** Evaluates the `when` of templates. */
  readonly contextKeys: Pick<ContextKeyService, 'createScoped'>;
  readonly prompts: PromptService | undefined;
  readonly notifications: NotificationService | undefined;
  readonly executeCommand: (id: string, ...args: unknown[]) => Promise<unknown>;
  readonly logger: Logger;
  /** Local editors can reveal files in the OS file manager. */
  readonly local: boolean;
}
