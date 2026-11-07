import { type Disposable, toDisposable } from '../lifecycle/disposable';
import { LogLevel } from './log-level.enum';
import type { LogEntry, LogSink, Logger } from './logger.type';

export const consoleSink: LogSink = (entry) => {
  const method = (['debug', 'debug', 'info', 'warn', 'error'] as const)[entry.level];
  console[method](`[${entry.source}] ${entry.message}`, ...entry.args);
};

/**
 * Central logging: named loggers write entries to sinks (browser console, the Console plugin…).
 * The last `bufferSize` entries are kept so a sink added late can replay history.
 */
export class LoggerService {
  private readonly _sinks = new Set<LogSink>();
  private readonly _buffer: LogEntry[] = [];

  level: LogLevel = LogLevel.Info;

  constructor(private readonly _bufferSize = 500) {}

  addSink(sink: LogSink, options: { replay?: boolean } = {}): Disposable {
    if (options.replay) for (const entry of this._buffer) sink(entry);
    this._sinks.add(sink);
    return toDisposable(() => this._sinks.delete(sink));
  }

  get history(): readonly LogEntry[] {
    return this._buffer;
  }

  getLogger(name: string): Logger {
    const log = (level: LogLevel, message: string, args: unknown[]) =>
      this.write({ level, source: name, message, args, time: Date.now() });
    return {
      name,
      trace: (message, ...args) => log(LogLevel.Trace, message, args),
      debug: (message, ...args) => log(LogLevel.Debug, message, args),
      info: (message, ...args) => log(LogLevel.Info, message, args),
      warn: (message, ...args) => log(LogLevel.Warn, message, args),
      error: (message, ...args) => log(LogLevel.Error, message, args),
      child: (child) => this.getLogger(`${name}.${child}`),
    };
  }

  /** Writes a full entry: for output that comes with its own values or location. */
  write(entry: LogEntry): void {
    if (entry.level < this.level) return;
    this._buffer.push(entry);
    if (this._buffer.length > this._bufferSize) this._buffer.shift();
    for (const sink of this._sinks) {
      try {
        sink(entry);
      } catch {}
    }
  }
}
