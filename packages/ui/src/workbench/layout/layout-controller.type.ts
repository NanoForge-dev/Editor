import type { HistoryService } from '@nanoforge-dev/editor-history';
import type { ExtensionRegistry, Logger } from '@nanoforge-dev/editor-kernel';
import type { SettingsService } from '@nanoforge-dev/editor-settings';

export interface LayoutControllerOptions {
  readonly extensions: ExtensionRegistry;
  readonly history: HistoryService;
  readonly settings: SettingsService;
  readonly logger?: Logger;
}
