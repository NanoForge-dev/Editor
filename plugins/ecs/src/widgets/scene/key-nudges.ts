/** A move made with the arrow keys, not written yet: shown at once, written once the keys rest. */
export interface KeyMove {
  readonly entity: string;
  readonly dx: number;
  readonly dy: number;
}

/** How long the keys rest before the presses in a row are written as one move. */
export const NUDGE_REST_MS = 400;

const STEPS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** The step of an arrow key: 1 unit, 10 with Shift; none for other keys or with Alt, Ctrl or Meta. */
export const nudgeStep = (
  event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
): readonly [number, number] | undefined => {
  const step = STEPS[event.key];
  if (!step || event.altKey || event.ctrlKey || event.metaKey) return undefined;
  const size = event.shiftKey ? 10 : 1;
  return [step[0] * size, step[1] * size];
};

export interface KeyNudgeOptions {
  /** The pending move (state the view owns, read to draw the shape where it goes). */
  readonly read: () => KeyMove | undefined;
  readonly write: (move: KeyMove | undefined) => void;
  /** Writes a finished move. */
  readonly commit: (move: KeyMove) => void;
}

export interface KeyNudges {
  /** Adds a step to the entity's pending move (a pending move of another entity is written first). */
  readonly press: (entity: string, step: readonly [number, number]) => void;
  /** Writes the pending move now. */
  readonly flush: () => void;
}

/** Arrow key presses in a row, gathered into one move written once the keys rest. */
export const keyNudges = ({ read, write, commit }: KeyNudgeOptions): KeyNudges => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    const current = read();
    write(undefined);
    if (current) commit(current);
  };
  const press = (entity: string, [dx, dy]: readonly [number, number]) => {
    if (read() && read()!.entity !== entity) flush();
    const pending = read();
    write({ entity, dx: (pending?.dx ?? 0) + dx, dy: (pending?.dy ?? 0) + dy });
    clearTimeout(timer);
    timer = setTimeout(flush, NUDGE_REST_MS);
  };
  return { press, flush };
};
