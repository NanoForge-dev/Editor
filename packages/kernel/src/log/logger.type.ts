import { type LogLevel } from './log-level.enum';
import type { LogValue } from './log-value.type';

export interface LogEntry {
  readonly level: LogLevel;
  /** Logger name, e.g. `kernel.plugins` or a plugin name. */
  readonly source: string;
  readonly message: string;
  readonly args: readonly unknown[];
  readonly time: number;
  /** The message's parts already serialized (output of a game): shown instead of `message`. */
  readonly values?: readonly LogValue[];
  /** Where it was logged: a file (or the URL of a built bundle) and a 1-based position. */
  readonly location?: LogLocation;
}

export interface LogLocation {
  readonly file: string;
  readonly line: number;
  readonly column?: number;
}

export type LogSink = (entry: LogEntry) => void;

export interface Logger {
  readonly name: string;
  trace(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  child(name: string): Logger;
}
