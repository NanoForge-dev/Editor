import type { CommandOrigin, HistoryCommand } from './history-command.type';

export const sameOrigin = (a: CommandOrigin | undefined, b: CommandOrigin | undefined): boolean =>
  a?.kind === b?.kind && a?.id === b?.id;

/** Runs children in order and undoes them in reverse. */
export const compositeCommand = (
  label: string,
  children: readonly HistoryCommand[],
  origin?: CommandOrigin,
): HistoryCommand => ({
  label,
  ...(origin && { origin }),
  children,
  sizeBytes: children.reduce((total, child) => total + (child.sizeBytes ?? 0), 0),
  async do() {
    for (const child of children) await child.do();
  },
  async undo() {
    for (const child of [...children].reverse()) await child.undo();
  },
  async redo() {
    for (const child of children) await (child.redo ?? child.do).call(child);
  },
  async isValid() {
    for (const child of children) if ((await child.isValid?.()) === false) return false;
    return true;
  },
  dispose() {
    for (const child of children) child.dispose?.();
  },
});

/** Default merge of two commands with the same merge key: first undo, last redo. */
export const mergeCommands = (previous: HistoryCommand, next: HistoryCommand): HistoryCommand => ({
  label: next.label,
  ...(previous.origin && { origin: previous.origin }),
  sizeBytes: (previous.sizeBytes ?? 0) + (next.sizeBytes ?? 0),
  ...(next.mergeKey && { mergeKey: next.mergeKey }),
  do: () => next.do(),
  undo: () => previous.undo(),
  redo: () => (next.redo ?? next.do).call(next),
  async isValid() {
    return (await previous.isValid?.()) !== false && (await next.isValid?.()) !== false;
  },
  dispose() {
    previous.dispose?.();
    next.dispose?.();
  },
});
