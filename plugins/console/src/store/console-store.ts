import {
  type Disposable,
  Emitter,
  type Event,
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
const toLine = (entry: LogEntry, id: number): ConsoleLine => {
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
  private readonly _errorsOnly = new Emitter<void>();
  private _errorsOnlyAsked = false;

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

  /** Fired when a command asks the Console to show only errors (or every level again). */
  get onErrorsOnly(): Event<void> {
    return this._errorsOnly.event;
  }

  /** Asks the Console to toggle errors only: now if it is shown, else when it mounts. */
  askErrorsOnly(): void {
    this._errorsOnlyAsked = true;
    this._errorsOnly.fire();
  }

  /** Whether errors only was asked and not handled yet (it is handled now). */
  takeErrorsOnly(): boolean {
    const asked = this._errorsOnlyAsked;
    this._errorsOnlyAsked = false;
    return asked;
  }

  dispose(): void {
    this._sink.dispose();
    this._errorsOnly.dispose();
  }
}
