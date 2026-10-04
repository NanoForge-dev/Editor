import {
  CodeServiceToken,
  DocumentServiceToken,
  type HistoryCommand,
  HistoryServiceToken,
  type PluginContext,
} from '@nanoforge-dev/editor-sdk';
import { NotificationServiceToken } from '@nanoforge-dev/editor-sdk/ui';

import { saved } from './saved-command';
import { SCENES_HISTORY } from './scene-history.const';
import type { Step } from './scene-step.type';

/**
 * Runs the Scenes edits: document edits saved after they run, and undo steps made of steps
 * computed one after the other.
 */
export class SceneSteps {
  constructor(
    private readonly _context: PluginContext,
    /** Called after a step is pushed: the scenes are read again. */
    private readonly _ondone: () => void,
  ) {}

  /**
   * A document edit command (`undefined` when nothing changes). The file is saved after it runs:
   * a structural change does not wait in an open editor.
   */
  async edit(path: string, transformer: string, op: unknown) {
    const code = this._context.services.tryGet(CodeServiceToken);
    const documents = this._context.services.tryGet(DocumentServiceToken);
    if (!code || !documents) throw new Error('No code service');
    const command = await code.edit(path, transformer, op, { label: 'Scenes' });
    return command ? saved(command, () => documents.save(path)) : undefined;
  }
  /** Commands run in order, undone in reverse. */
  group(label: string, children: readonly HistoryCommand[]): HistoryCommand | undefined {
    if (!children.length) return undefined;
    return {
      label,
      children,
      do: async () => {
        for (const child of children) await child.do();
      },
      undo: async () => {
        for (const child of [...children].reverse()) await child.undo();
      },
    };
  }
  /**
   * Pushes one undo step in the Scenes history, made of steps computed and run one after the
   * other (each on the files the previous ones changed). Notifies and returns false when refused.
   */
  async push(label: string, steps: readonly Step[]): Promise<boolean> {
    const done: HistoryCommand[] = [];
    const command: HistoryCommand = {
      label,
      do: async () => {
        if (done.length) {
          for (const step of done) await step.do();
          return;
        }
        for (const step of steps) {
          const next = await step();
          if (!next) continue;
          await next.do();
          done.push(next);
        }
      },
      undo: async () => {
        for (const step of [...done].reverse()) await step.undo();
      },
    };
    try {
      const history = this.history();
      if (history) await history.stack.push(command);
      else await command.do();
      this._ondone();
      return true;
    } catch (error) {
      for (const step of [...done].reverse())
        await Promise.resolve(step.undo()).catch(() => undefined);
      return this.fail(label, error instanceof Error ? error.message : String(error));
    }
  }
  fail(title: string, detail: string): false {
    this._context.services
      .tryGet(NotificationServiceToken)
      ?.notify('warning', `${title}: not possible`, { detail });
    return false;
  }
  /** The Scenes undo context (registered on first use). */
  history() {
    const history = this._context.services.tryGet(HistoryServiceToken);
    return history
      ? (history.get(SCENES_HISTORY) ??
          history.registerContext({
            id: SCENES_HISTORY,
            label: 'Scenes',
            owner: this._context.name,
          }))
      : undefined;
  }
}
