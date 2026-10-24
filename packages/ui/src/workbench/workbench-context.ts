import { getContext, setContext } from 'svelte';

import type {
  CommandRegistry,
  ContextKeyService,
  ExtensionRegistry,
  Logger,
} from '@nanoforge-dev/editor-kernel';

import type { KeybindingService } from './keybinding/keybinding-service';
import type { DragController } from './layout/drag-controller';
import type { LayoutController } from './layout/layout-controller';
import type { MenuContext } from './menu/resolve-menu';
import type { NotificationService } from './notification/notification-service';
import type { PromptService } from './prompt/prompt-service';
import type { WorkbenchService } from './service/workbench-service';

export interface WorkbenchContext extends MenuContext {
  readonly workbench: WorkbenchService;
  readonly layout: LayoutController;
  readonly drag: DragController;
  readonly notifications: NotificationService;
  readonly prompts: PromptService;
  readonly extensions: ExtensionRegistry;
  readonly commands: CommandRegistry;
  readonly contextKeys: ContextKeyService;
  readonly keybindings: KeybindingService;
  readonly logger: Logger;
}

const KEY = Symbol('nanoforge-workbench');

export const setWorkbenchContext = (context: WorkbenchContext): void => {
  setContext(KEY, context);
};

export const getWorkbenchContext = (): WorkbenchContext => {
  const context = getContext<WorkbenchContext | undefined>(KEY);
  if (!context) throw new Error('Workbench parts must be rendered inside <Workbench>');
  return context;
};
