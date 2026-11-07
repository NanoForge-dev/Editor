/**
 * Modules provided by the editor host at runtime. Editor plugins never bundle them:
 * their imports are rewritten to lookups in the host's shared module registry, so every
 * plugin runs against the exact same Svelte runtime and SDK instance as the editor.
 *
 * Keep in sync with the host registration (apps/editor/src/lib/plugins/shared-modules.ts).
 */
/** Modules the editor page provides (main thread). */
export const MAIN_SHARED_MODULES = [
  'svelte',
  'svelte/animate',
  'svelte/attachments',
  'svelte/easing',
  'svelte/events',
  'svelte/internal/client',
  'svelte/legacy',
  'svelte/motion',
  'svelte/reactivity',
  'svelte/reactivity/window',
  'svelte/store',
  'svelte/transition',
  '@nanoforge-dev/editor-sdk',
  '@nanoforge-dev/editor-sdk/ui',
] as const;

/** Modules the code worker provides to plugin worker entries (`entry.worker`). */
export const WORKER_SHARED_MODULES = ['ts-morph', '@nanoforge-dev/editor-sdk/worker'] as const;

export const SHARED_MODULES = [...MAIN_SHARED_MODULES, ...WORKER_SHARED_MODULES] as const;

export type SharedModuleId = (typeof SHARED_MODULES)[number];

/** Side-effect only modules the host already evaluated: their imports are dropped. */
export const DROPPED_MODULES: ReadonlySet<string> = new Set([
  'svelte/internal/disclose-version',
  'svelte/internal/flags/tracing',
]);

/** Modules that would switch global runtime flags of the host: importing them is a build error. */
export const FORBIDDEN_MODULES: ReadonlyMap<string, string> = new Map([
  [
    'svelte/internal/flags/legacy',
    'Editor plugins must compile Svelte components in runes mode (compilerOptions.runes = true).',
  ],
  [
    'svelte/internal/flags/async',
    'Editor plugins cannot enable experimental async Svelte: the editor host does not use it.',
  ],
]);

/** Name of the global object the host exposes; must match the kernel's `SharedModuleRegistry`. */
export const SHARED_GLOBAL = '__nanoforge_editor_shared__';

const SHARED_SET: ReadonlySet<string> = new Set(SHARED_MODULES);

export const isSharedModule = (specifier: string): specifier is SharedModuleId =>
  SHARED_SET.has(specifier);

/** Whether the bundler must leave this import to the host (shared, dropped or forbidden). */
export const isHostModule = (specifier: string): boolean =>
  SHARED_SET.has(specifier) || DROPPED_MODULES.has(specifier) || FORBIDDEN_MODULES.has(specifier);
