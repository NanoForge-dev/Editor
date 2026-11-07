import { vi } from 'vitest';

/** `@nanoforge-dev/editor-sdk/ui` without its Svelte components, for tests in Node. */
export const uiMock = () => ({
  FILE_ICONS: { id: 'files.icons' },
  FILE_TEMPLATES: { id: 'files.templates' },
  FILE_ACTIONS: { id: 'files.actions' },
  notifyError: vi.fn(),
});
