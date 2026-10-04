import { type Observable, ObservableValue, createToken } from '@nanoforge-dev/editor-kernel';

export interface PromptOptions {
  readonly title: string;
  readonly label: string;
  readonly value?: string;
  readonly confirm?: string;
  /** Returns an error message for invalid values. */
  readonly validate?: (value: string) => string | undefined;
  /** An empty value can be confirmed (an optional field): it resolves to `''`. */
  readonly optional?: boolean;
}

export interface PendingPrompt extends PromptOptions {
  readonly resolve: (value: string | undefined) => void;
}

/** Asks the user for a short text in a dialog (no blocking browser prompts). */
export class PromptService {
  private readonly _current = new ObservableValue<PendingPrompt | undefined>(undefined);

  get current(): Observable<PendingPrompt | undefined> {
    return this._current.readonly();
  }

  ask(options: PromptOptions): Promise<string | undefined> {
    this._current.get()?.resolve(undefined);
    return new Promise((resolve) => {
      this._current.set({
        ...options,
        resolve: (value) => {
          this._current.set(undefined);
          resolve(value);
        },
      });
    });
  }
}

export const PromptServiceToken = createToken<PromptService>('ui.prompt');
