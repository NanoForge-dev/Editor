// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {}

  /** Version of the editor, injected at build time. */
  const __EDITOR_VERSION__: string;
}

export {};
