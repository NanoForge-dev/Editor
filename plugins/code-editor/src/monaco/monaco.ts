import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker.js?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker.js?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker.js?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker.js?worker';

export { monaco };
export type Monaco = typeof monaco;

let configured = false;

/**
 * One-time Monaco setup: workers, TypeScript defaults. Diagnostics come from the editor's code
 * worker (a single TypeScript for the whole editor) and formatting from Prettier, so Monaco's
 * own TypeScript diagnostics and formatters are turned off.
 */
export const setupMonaco = (): Monaco => {
  if (configured) return monaco;
  configured = true;
  (self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
    getWorker: (_id, label) => {
      if (label === 'typescript' || label === 'javascript') return new TsWorker();
      if (label === 'json') return new JsonWorker();
      if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
      if (label === 'html') return new HtmlWorker();
      return new EditorWorker();
    },
  };
  const ts = monaco.typescript;
  const compilerOptions: Parameters<typeof ts.typescriptDefaults.setCompilerOptions>[0] = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: 100 as never,
    lib: ['esnext', 'dom', 'dom.iterable'],
    strict: true,
    allowJs: true,
    checkJs: false,
    esModuleInterop: true,
    skipLibCheck: true,
    allowNonTsExtensions: true,
    experimentalDecorators: true,
    resolveJsonModule: true,
  };
  const modes: Parameters<typeof ts.typescriptDefaults.setModeConfiguration>[0] = {
    completionItems: true,
    hovers: true,
    documentSymbols: true,
    definitions: true,
    references: true,
    documentHighlights: true,
    rename: true,
    diagnostics: false,
    documentRangeFormattingEdits: false,
    signatureHelp: true,
    onTypeFormattingEdits: false,
    codeActions: true,
    inlayHints: true,
  };
  for (const defaults of [ts.typescriptDefaults, ts.javascriptDefaults]) {
    defaults.setCompilerOptions(compilerOptions);
    defaults.setModeConfiguration(modes);
    defaults.setEagerModelSync(true);
  }
  return monaco;
};

/** Monaco model URI of a project path (`apps/client/src/main.ts`). */
export const uriOf = (path: string): monaco.Uri => monaco.Uri.parse(`file:///${path}`);

/** Project path of a Monaco model URI. */
export const pathOf = (uri: monaco.Uri): string => decodeURIComponent(uri.path.replace(/^\//, ''));
