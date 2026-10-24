import { defineExtensionPoint } from '../extension/define-extension-point';
import type { ExtensionPoint } from '../extension/extension-point.type';
import type { CommandMetadataContribution } from './plugin-host.type';

/** Commands declared by manifests (activated or not), for palettes and menus. */
export const COMMAND_METADATA: ExtensionPoint<CommandMetadataContribution> =
  defineExtensionPoint('core.commandMetadata');
