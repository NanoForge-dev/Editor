import type { CommandRegistry } from '../command/command-registry';
import type { ContextKeyService } from '../context/context-key-service';
import { createToken } from '../di/service-token';
import type { EventBus } from '../event/event-bus';
import type { ExtensionRegistry } from '../extension/extension-registry';
import type { LocalizationService } from '../i18n/localization-service';
import type { LoggerService } from '../log/logger-service';
import type { EngineLibProvider } from './engine-libs';

/** Well-known services every editor container provides. */
export const CoreServices = {
  Commands: createToken<CommandRegistry>('core.commands'),
  ContextKeys: createToken<ContextKeyService>('core.contextKeys'),
  /** Typed as `EventBus<EditorEvents>` by the SDK. */
  EventBus: createToken<EventBus>('core.eventBus'),
  Extensions: createToken<ExtensionRegistry>('core.extensions'),
  Localization: createToken<LocalizationService>('core.localization'),
  Logger: createToken<LoggerService>('core.logger'),
  EngineLibs: createToken<EngineLibProvider>('core.engineLibs'),
} as const;
