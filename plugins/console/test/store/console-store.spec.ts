import { describe, expect, it } from 'vitest';

import { type LogEntry, LogLevel } from '@nanoforge-dev/editor-sdk';

import { ConsoleStore } from '../../src/store/console-store';
import { groupOf, sourceLabel } from '../../src/store/log-sources';

/** The part of the editor's logger the console uses: sinks, with a replay of earlier entries. */
class Logs {
  private readonly _sinks = new Set<(entry: LogEntry) => void>();
  private readonly _history: LogEntry[] = [];

  addSink(sink: (entry: LogEntry) => void, options: { replay?: boolean } = {}) {
    if (options.replay) for (const entry of this._history) sink(entry);
    this._sinks.add(sink);
    return { dispose: () => void this._sinks.delete(sink) };
  }

  write(entry: LogEntry): void {
    this._history.push(entry);
    for (const sink of this._sinks) sink(entry);
  }

  getLogger(source: string) {
    const log =
      (level: LogLevel) =>
      (message: string, ...args: unknown[]) =>
        this.write({ level, source, message, args, time: Date.now() });
    return { info: log(LogLevel.Info), warn: log(LogLevel.Warn) };
  }
}

const setup = (maxLines = 100) => {
  const logs = new Logs();
  return { logs, store: new ConsoleStore(logs, () => maxLines) };
};

describe('sources', () => {
  it('groups sources by where they come from', () => {
    expect(
      ['game:client', 'build:apps/client', 'cli:nf install', '@acme/hello', 'kernel.plugins'].map(
        groupOf,
      ),
    ).toEqual(['game', 'build', 'tasks', 'plugins', 'editor']);
    expect(sourceLabel('game:server')).toBe('server');
    expect(sourceLabel('build:')).toBe('project');
    expect(sourceLabel('@acme/hello')).toBe('@acme/hello');
  });
});

describe('ConsoleStore', () => {
  it('replays earlier entries and follows new ones', () => {
    const logs = new Logs();
    logs.getLogger('editor').info('before');
    const store = new ConsoleStore(logs);
    logs.getLogger('@acme/hello').warn('after');
    expect(store.lines.map((line) => [line.group, line.level, line.text])).toEqual([
      ['editor', 'info', 'before'],
      ['plugins', 'warn', 'after'],
    ]);
  });

  it('merges identical consecutive lines into one with a count', () => {
    const { logs, store } = setup();
    const game = logs.getLogger('game:client');
    game.info('tick');
    game.info('tick');
    game.info('tick');
    game.warn('tick');
    logs.getLogger('game:server').warn('tick');
    game.info('tick');
    expect(store.lines.map((line) => [line.source, line.level, line.count])).toEqual([
      ['game:client', 'info', 3],
      ['game:client', 'warn', 1],
      ['game:server', 'warn', 1],
      ['game:client', 'info', 1],
    ]);
  });

  it('keeps logged values as trees, and plain text as text', () => {
    const { logs, store } = setup();
    logs.getLogger('editor').info('saved', { files: 2 }, 'ok');
    logs.getLogger('editor').info('count', 3);
    logs.write({
      level: LogLevel.Debug,
      source: 'game:client',
      message: 'score {"left":1}',
      args: [],
      time: 1,
      values: ['score', { type: 'object', entries: [['left', 1]] }],
      location: { file: 'http://x/main.js', line: 3, column: 1 },
    });
    const [saved, count, game] = store.lines;
    expect(saved).toMatchObject({ text: 'saved { files: 2 } ok' });
    expect(saved!.values).toHaveLength(3);
    expect(count).toMatchObject({ text: 'count 3' });
    expect(count!.values).toBeUndefined();
    expect(game).toMatchObject({
      level: 'debug',
      text: 'score {"left":1}',
      location: { line: 3 },
    });
    expect(game!.values).toHaveLength(2);
  });

  it('drops the oldest lines over the limit, and clears', () => {
    const { logs, store } = setup(2);
    const logger = logs.getLogger('editor');
    logger.info('a');
    logger.info('b');
    logger.info('c');
    expect(store.lines.map((line) => line.text)).toEqual(['b', 'c']);
    let revisions = 0;
    store.revision.subscribe(() => revisions++);
    store.clear();
    expect(store.lines).toEqual([]);
    expect(revisions).toBeGreaterThan(0);
  });
});
