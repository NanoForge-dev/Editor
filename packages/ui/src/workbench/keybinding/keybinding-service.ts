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
/** A modifier pressed and released alone, held at most this long, is a tap. */
const TAP_MS = 400;
/** Two taps of the same modifier this close are a double tap: `Shift Shift`. */
const DOUBLE_TAP_MS = 500;
const MODIFIER_KEYS: Readonly<Record<string, string>> = {
  Shift: 'Shift',
  Control: 'Ctrl',
  Alt: 'Alt',
  Meta: 'Meta',
};

/** Dispatches keyboard shortcuts to commands, honoring `when` clauses, the preset and user overrides. */
export class KeybindingService implements Disposable {
  private readonly _store = new DisposableStore();
  private _pending: { strokes: string[]; timer: ReturnType<typeof setTimeout> } | undefined;
  private _suspended = 0;
  /** The modifier held alone right now, and since when. */
  private _held: { modifier: string; since: number } | undefined;
  /** The last tap of a modifier, waiting for a second one. */
  private _tap: { modifier: string; at: number } | undefined;

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

  /** Listens to keydown (and keyup, for double taps) on a target (the editor window). */
  attach(target: Pick<Window, 'addEventListener' | 'removeEventListener'>): Disposable {
    const down = (event: Event) => this.handle(event as KeyboardEvent);
    const up = (event: Event) => this.handleKeyUp(event as KeyboardEvent);
    target.addEventListener('keydown', down, { capture: true });
    target.addEventListener('keyup', up, { capture: true });
    return this._store.add(
      toDisposable(() => {
        target.removeEventListener('keydown', down, { capture: true });
        target.removeEventListener('keyup', up, { capture: true });
      }),
    );
  }

  /** Returns true when the event ran (or started) a keybinding; its default is then prevented. */
  handle(event: KeyboardEvent): boolean {
    if (this._suspended) return false;
    const modifier = MODIFIER_KEYS[event.key];
    if (modifier) {
      const alone = ['ctrlKey', 'altKey', 'shiftKey', 'metaKey'].filter(
        (flag) => event[flag as 'ctrlKey'],
      );
      if (!event.repeat)
        this._held = alone.length <= 1 ? { modifier, since: Date.now() } : undefined;
      return false;
    }
    this._held = undefined;
    this._tap = undefined;
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

  /**
   * A modifier released alone counts as a tap; a second tap of it soon after runs the binding of
   * the double tap (`Shift Shift`). A single tap never starts a chord: typing goes on as usual.
   */
  handleKeyUp(event: KeyboardEvent): boolean {
    const held = this._held;
    this._held = undefined;
    const modifier = MODIFIER_KEYS[event.key];
    if (this._suspended || !held || held.modifier !== modifier) return false;
    const now = Date.now();
    if (now - held.since > TAP_MS) {
      this._tap = undefined;
      return false;
    }
    const tap = this._tap;
    if (!tap || tap.modifier !== modifier || now - tap.at > DOUBLE_TAP_MS) {
      this._tap = { modifier, at: now };
      return false;
    }
    this._tap = undefined;
    const binding = this.bindings.find(
      (candidate) =>
        candidate.strokes.length === 2 &&
        candidate.strokes.every((stroke) => stroke === modifier) &&
        this._context.evaluate(candidate.when),
    );
    if (!binding) return false;
    this._clearPending();
    this._commands
      .execute(binding.command, ...binding.args)
      .catch((error: unknown) =>
        this._logger?.error(`Keybinding ${binding.key} → ${binding.command} failed`, error),
      );
    return true;
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
