import {
  type Disposable,
  type LogEntry,
  LogLevel,
  type LogLocation,
  type LogValue,
  type LoggerService,
  ObservableValue,
  formatLogValue,
  serializeLogValue,
} from '@nanoforge-dev/editor-sdk';

import { type GroupId, groupOf } from './log-sources';

export type LineLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ConsoleLine {
  readonly id: number;
  readonly time: number;
  readonly level: LineLevel;
  readonly source: string;
  readonly group: GroupId;
  /** The whole line as text (search, copy, repeats). */
  readonly text: string;
  /** The logged values, when there is more than text to show. */
  readonly values?: readonly LogValue[];
  readonly location?: LogLocation;
  /** How many identical lines in a row this one stands for. */
  readonly count: number;
}

const LEVELS: Record<LogLevel, LineLevel> = {
  [LogLevel.Trace]: 'debug',
  [LogLevel.Debug]: 'debug',
  [LogLevel.Info]: 'info',
  [LogLevel.Warn]: 'warn',
  [LogLevel.Error]: 'error',
};

const hasTree = (values: readonly LogValue[]): boolean =>
  values.some((value) => value !== null && typeof value === 'object');

/** A log entry as a console line: values are snapshots taken now. */
export const toLine = (entry: LogEntry, id: number): ConsoleLine => {
  const values =
    entry.values ??
    (entry.args.length
      ? [entry.message, ...entry.args.map((arg) => serializeLogValue(arg))]
      : undefined);
  const text = entry.values
    ? entry.message
    : values
      ? values.map((value) => formatLogValue(value)).join(' ')
      : entry.message;
  return {
    id,
    time: entry.time,
    level: LEVELS[entry.level],
    source: entry.source,
    group: groupOf(entry.source),
    text,
    ...(values && hasTree(values) && { values }),
    ...(entry.location && { location: entry.location }),
    count: 1,
  };
};

/**
 * The lines of the console: every log entry of the editor (its own loggers, plugins, and the
 * game, build and task output the runtime writes), with identical consecutive lines merged and
 * the oldest dropped.
 */
export class ConsoleStore implements Disposable {
  private _lines: ConsoleLine[] = [];
  private _next = 0;
  private readonly _revision = new ObservableValue(0);
  private readonly _sink: Disposable;

  /** Bumped when the lines change. */
  readonly revision = this._revision.readonly();

  constructor(
    logs: Pick<LoggerService, 'addSink'>,
    private readonly _maxLines: () => number = () => 2000,
  ) {
    this._sink = logs.addSink((entry) => this.add(entry), { replay: true });
  }

  get lines(): readonly ConsoleLine[] {
    return this._lines;
  }

  add(entry: LogEntry): void {
    const line = toLine(entry, this._next++);
    const last = this._lines[this._lines.length - 1];
    if (
      last &&
      last.source === line.source &&
      last.level === line.level &&
      last.text === line.text
    ) {
      this._lines[this._lines.length - 1] = { ...last, time: line.time, count: last.count + 1 };
    } else {
      this._lines.push(line);
      const extra = this._lines.length - Math.max(this._maxLines(), 1);
      if (extra > 0) this._lines.splice(0, extra);
    }
    this._revision.set(this._revision.get() + 1);
  }

  clear(): void {
    this._lines = [];
    this._revision.set(this._revision.get() + 1);
  }

  dispose(): void {
    this._sink.dispose();
  }
}
