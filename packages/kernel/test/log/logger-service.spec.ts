import { describe, expect, it, vi } from 'vitest';

import { LogLevel } from '../../src/log/log-level.enum';
import { LoggerService } from '../../src/log/logger-service';

describe('LoggerService', () => {
  it('filters by level, buffers and replays', () => {
    const logs = new LoggerService(2);
    const logger = logs.getLogger('kernel').child('plugins');
    logger.debug('hidden');
    logger.info('a');
    logger.warn('b', 1);
    logger.error('c');
    expect(logs.history.map((e) => e.message)).toEqual(['b', 'c']);

    const sink = vi.fn();
    logs.addSink(sink, { replay: true });
    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink.mock.calls[0]![0]).toMatchObject({
      source: 'kernel.plugins',
      level: LogLevel.Warn,
      args: [1],
    });
  });

  it('isolates failing sinks', () => {
    const logs = new LoggerService();
    const ok = vi.fn();
    logs.addSink(() => {
      throw new Error('x');
    });
    logs.addSink(ok);
    logs.getLogger('x').error('boom');
    expect(ok).toHaveBeenCalledOnce();
  });
});
