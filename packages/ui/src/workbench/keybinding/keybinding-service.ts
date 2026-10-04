import {
  type CommandRegistry,
  type ContextKeyService,
  type Disposable,
  DisposableStore,
  type ExtensionRegistry,
  type Logger,
  type Observable,
  constant,
  createToken,
  toDisposable,
} from '@nanoforge-dev/editor-kernel';

import { KEYBINDINGS } from '../extension-point/keybinding.extension-point';
import type { KeybindingConflict, KeymapOverride, ResolvedKeybinding } from './keymap.type';
import { startsWith, strokeFromEvent } from './keystroke';
import { actionId, findConflicts, resolveKeymap } from './resolve-keymap';

const CHORD_TIMEOUT_MS = 1500;

/** Dispatches keyboard shortcuts to commands, honoring `when` clauses, the preset and user overrides. */
export class KeybindingService implements Disposable {
  private readonly _store = new DisposableStore();
  private _pending: { strokes: string[]; timer: ReturnType<typeof setTimeout> } | undefined;
  private _suspended = 0;

  constructor(
    private readonly _extensions: ExtensionRegistry,
    private readonly _commands: CommandRegistry,
    private readonly _context: ContextKeyService,
    private readonly _overrides: Observable<readonly KeymapOverride[]> = constant([]),
    private readonly _logger?: Logger,
    /** Entries of the chosen preset (`keymap.preset`). */
    private readonly _preset: Observable<readonly KeymapOverride[]> = constant([]),
  ) {}

  /** Effective bindings, see {@link resolveKeymap}. */
  get bindings(): ResolvedKeybinding[] {
    return resolveKeymap(
      this._extensions.getValues(KEYBINDINGS),
      this._preset.get(),
      this._overrides.get(),
      (binding, error) =>
        this._logger?.warn(`Ignoring keybinding ${binding.key} → ${binding.command}`, error),
    );
  }

  /** Keybinding shown next to a command (run with these arguments) in menus. */
  keyFor(command: string, args: readonly unknown[] = []): string | undefined {
    const action = actionId(command, args);
    const forAction = this.bindings.filter(
      (candidate) => actionId(candidate.command, candidate.args) === action,
    );
    const binding =
      forAction.find((candidate) => this._context.evaluate(candidate.when)) ?? forAction[0];
    return binding?.strokes.join(' ');
  }

  /** Shortcuts that get in each other's way, see {@link findConflicts}. */
  conflicts(): KeybindingConflict[] {
    return findConflicts(this.bindings);
  }

  /**
   * Stops dispatching until disposed: keys reach the focused element (a shortcut recorder).
   */
  suspend(): Disposable {
    this._suspended++;
    this._clearPending();
    let disposed = false;
    return toDisposable(() => {
      if (disposed) return;
      disposed = true;
      this._suspended--;
    });
  }

  /** Listens to keydown on a target (the editor window). */
  attach(target: Pick<Window, 'addEventListener' | 'removeEventListener'>): Disposable {
    const listener = (event: Event) => this.handle(event as KeyboardEvent);
    target.addEventListener('keydown', listener, { capture: true });
    return this._store.add(
      toDisposable(() => target.removeEventListener('keydown', listener, { capture: true })),
    );
  }

  /** Returns true when the event ran (or started) a keybinding; its default is then prevented. */
  handle(event: KeyboardEvent): boolean {
    if (this._suspended) return false;
    const stroke = strokeFromEvent(event);
    if (!stroke) return false;
    const strokes = [...(this._pending?.strokes ?? []), stroke];
    this._clearPending();
    const candidates = this.bindings.filter(
      (binding) => startsWith(binding.strokes, strokes) && this._context.evaluate(binding.when),
    );
    const exact = candidates.find((binding) => binding.strokes.length === strokes.length);
    if (exact) {
      event.preventDefault();
      event.stopPropagation();
      this._commands
        .execute(exact.command, ...exact.args)
        .catch((error: unknown) =>
          this._logger?.error(`Keybinding ${exact.key} → ${exact.command} failed`, error),
        );
      return true;
    }
    if (candidates.length) {
      event.preventDefault();
      this._pending = { strokes, timer: setTimeout(() => this._clearPending(), CHORD_TIMEOUT_MS) };
      return true;
    }
    return false;
  }

  dispose(): void {
    this._clearPending();
    this._store.dispose();
  }

  private _clearPending(): void {
    if (this._pending) clearTimeout(this._pending.timer);
    this._pending = undefined;
  }
}

export const KeybindingServiceToken = createToken<KeybindingService>('ui.keybindings');
