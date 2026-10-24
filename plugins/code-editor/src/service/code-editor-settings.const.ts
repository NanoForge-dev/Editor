/** Settings of the plugin (declared in its manifest, prefixed with its name). */
export const SETTING = {
  autoSaveAfterDelay: '@nanoforge/code-editor.autoSave.afterDelay',
  autoSaveDelayMs: '@nanoforge/code-editor.autoSave.delayMs',
  autoSaveOnFocusLoss: '@nanoforge/code-editor.autoSave.onFocusLoss',
  formatOnSave: '@nanoforge/code-editor.onSave.format',
  organizeImportsOnSave: '@nanoforge/code-editor.onSave.organizeImports',
  fontSize: '@nanoforge/code-editor.fontSize',
  minimap: '@nanoforge/code-editor.minimap',
  wordWrap: '@nanoforge/code-editor.wordWrap',
} as const;
