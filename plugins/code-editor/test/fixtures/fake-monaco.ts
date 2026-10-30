import { vi } from 'vitest';

type Listener = (event: { changes: [] }) => void;

/** Just what the code editor reads of a Monaco text model. */
export const fakeModel = (initial: string) => {
  let text = initial;
  let version = 1;
  const listeners = new Set<Listener>();
  const changed = () => {
    version++;
    for (const listener of listeners) listener({ changes: [] });
  };
  return {
    getValue: () => text,
    getAlternativeVersionId: () => version,
    onDidChangeContent: (listener: Listener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    getFullModelRange: () => ({}),
    pushStackElement: () => undefined,
    pushEditOperations: (_selection: unknown, operations: { text: string }[]) => {
      text = operations.map((operation) => operation.text).join('');
      changed();
      return null;
    },
    dispose: vi.fn(),
    /** A user's keystrokes. */
    type(more: string) {
      text += more;
      changed();
    },
  };
};
export type FakeModel = ReturnType<typeof fakeModel>;

/** Monaco as the code editor uses it: models by path (`uriOf` is mocked to the path). */
export const fakeMonaco = () => {
  const models = new Map<string, FakeModel>();
  const extraLib = () => ({ dispose: () => undefined });
  return {
    models,
    editor: {
      getModel: (path: string) => models.get(path),
      createModel: (text: string, _language: unknown, path: string) => {
        const model = fakeModel(text);
        models.set(path, model);
        return model;
      },
      registerEditorOpener: () => ({ dispose: () => undefined }),
      setModelMarkers: vi.fn(),
      defineTheme: vi.fn(),
      setTheme: vi.fn(),
      remeasureFonts: vi.fn(),
    },
    typescript: {
      typescriptDefaults: { addExtraLib: extraLib },
      javascriptDefaults: { addExtraLib: extraLib },
    },
  };
};
