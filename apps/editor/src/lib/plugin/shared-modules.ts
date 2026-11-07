import * as svelte from 'svelte';
import * as svelteAnimate from 'svelte/animate';
import * as svelteAttachments from 'svelte/attachments';
import * as svelteEasing from 'svelte/easing';
import * as svelteEvents from 'svelte/events';
// eslint-disable-next-line svelte/no-svelte-internal
import * as svelteInternalClient from 'svelte/internal/client';
import * as svelteLegacy from 'svelte/legacy';
import * as svelteMotion from 'svelte/motion';
import * as svelteReactivity from 'svelte/reactivity';
import * as svelteReactivityWindow from 'svelte/reactivity/window';
import * as svelteStore from 'svelte/store';
import * as svelteTransition from 'svelte/transition';

import { type ModuleNamespace, SharedModuleRegistry } from '@nanoforge-dev/editor-kernel';
import * as sdk from '@nanoforge-dev/editor-sdk';
import * as sdkUi from '@nanoforge-dev/editor-sdk/ui';

/**
 * Modules the editor shares with plugins, keyed by import specifier.
 * Must list exactly `MAIN_SHARED_MODULES` of `@nanoforge-dev/editor-vite-plugin` (checked by a test).
 */
export const SHARED_MODULE_NAMESPACES: Readonly<Record<string, ModuleNamespace>> = {
  svelte,
  'svelte/animate': svelteAnimate,
  'svelte/attachments': svelteAttachments,
  'svelte/easing': svelteEasing,
  'svelte/events': svelteEvents,
  'svelte/internal/client': svelteInternalClient,
  'svelte/legacy': svelteLegacy,
  'svelte/motion': svelteMotion,
  'svelte/reactivity': svelteReactivity,
  'svelte/reactivity/window': svelteReactivityWindow,
  'svelte/store': svelteStore,
  'svelte/transition': svelteTransition,
  '@nanoforge-dev/editor-sdk': sdk,
  '@nanoforge-dev/editor-sdk/ui': sdkUi,
};

let registry: SharedModuleRegistry | undefined;

/** Installs the shared module registry once, in the browser, before any plugin is imported. */
export const installSharedModules = (): SharedModuleRegistry => {
  if (registry) return registry;
  registry = new SharedModuleRegistry();
  for (const [id, namespace] of Object.entries(SHARED_MODULE_NAMESPACES)) {
    registry.register(id, namespace);
  }
  const uninstall = registry.install();
  import.meta.hot?.dispose(uninstall);
  return registry;
};
