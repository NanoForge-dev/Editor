import { describe, expect, it } from 'vitest';

import { framesCsv, packetsCsv, toCsv } from '../../src/export/inspector-export';

describe('inspector export', () => {
  it('quotes fields with commas, quotes and line breaks', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['x,y', 'say "hi"'],
          ['line\nbreak', undefined],
        ],
      ),
    ).toBe('a,b\n"x,y","say ""hi"""\n"line\nbreak",\n');
  });

  it('writes a row per window, a column per library', () => {
    const frame = (time: number, physics?: number) => ({
      time,
      stats: {
        windowMs: 250,
        ticks: 15,
        tps: 60,
        tick: { avg: 2, max: 5 },
        libraries: physics === undefined ? {} : { physics: { avg: physics, max: physics } },
      },
    });
    expect(framesCsv([frame(0, 1.5), frame(250)]).split('\n')).toEqual([
      'time,ticks per second,average tick ms,slowest tick ms,physics ms',
      '1970-01-01T00:00:00.000Z,60,2,5,1.5',
      '1970-01-01T00:00:00.250Z,60,2,5,',
      '',
    ]);
  });

  it('writes a row per packet with its payload', () => {
    const packet = {
      id: 0,
      time: 0,
      direction: 'in',
      transport: 'tcp',
      size: 2,
      head: '6869',
    } as never;
    expect(packetsCsv([packet], () => 'hi').split('\n')[1]).toBe(
      '1970-01-01T00:00:00.000Z,in,tcp,,2,6869,hi',
    );
  });
});
