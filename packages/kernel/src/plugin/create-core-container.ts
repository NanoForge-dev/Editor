import { CommandRegistry } from '../command/command-registry';
import { ContextKeyService } from '../context/context-key-service';
import { Container } from '../di/container';
import { EventBus } from '../event/event-bus';
import { ExtensionRegistry } from '../extension/extension-registry';
import { LocalizationService } from '../i18n/localization-service';
import { LoggerService } from '../log/logger-service';
import { CoreServices } from './core-services.const';

/** Creates the editor root container with every core kernel service registered. */
export const createCoreContainer = (options: { logger?: LoggerService } = {}): Container => {
  const container = new Container('editor');
  container.provideFactory(CoreServices.ContextKeys, () => new ContextKeyService());
  container.provideFactory(CoreServices.Extensions, () => new ExtensionRegistry());
  container.provideFactory(CoreServices.EventBus, () => new EventBus());
  container.provideFactory(CoreServices.Localization, () => new LocalizationService());
  if (options.logger) container.provide(CoreServices.Logger, options.logger);
  else container.provideFactory(CoreServices.Logger, () => new LoggerService());
  container.provideFactory(
    CoreServices.Commands,
    (services) => new CommandRegistry(services, services.get(CoreServices.ContextKeys)),
  );
  return container;
};
