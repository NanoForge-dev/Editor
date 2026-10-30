import type { FrameSample, Packet } from '../recorder/recorder';

/** A CSV field: quoted when it holds a comma, a quote or a line break. */
const field = (value: string | number | undefined): string => {
  const text = value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Rows to CSV, a header first, lines ending with `\n`. */
export const toCsv = (
  header: readonly string[],
  rows: readonly (readonly (string | number | undefined)[])[],
): string => [header, ...rows].map((row) => row.map(field).join(',')).join('\n') + '\n';

/** The profiler's windows: one row each, the libraries' average times as columns. */
export const framesCsv = (frames: readonly FrameSample[]): string => {
  const libraries = [...new Set(frames.flatMap((frame) => Object.keys(frame.stats.libraries)))];
  return toCsv(
    [
      'time',
      'ticks per second',
      'average tick ms',
      'slowest tick ms',
      ...libraries.map((name) => `${name} ms`),
    ],
    frames.map((frame) => [
      new Date(frame.time).toISOString(),
      frame.stats.tps,
      frame.stats.tick.avg,
      frame.stats.tick.max,
      ...libraries.map((name) => frame.stats.libraries[name]?.avg),
    ]),
  );
};

/** The network's packets: one row each, the payload the editor has as hexadecimal and as text. */
export const packetsCsv = (
  packets: readonly Packet[],
  textOf: (packet: Packet) => string,
): string =>
  toCsv(
    ['time', 'direction', 'transport', 'client', 'size', 'payload hex', 'payload text'],
    packets.map((packet) => [
      new Date(packet.time).toISOString(),
      packet.direction,
      packet.transport,
      packet.clientId,
      packet.size,
      packet.data ?? packet.head,
      textOf(packet),
    ]),
  );

/** `<what>-<date>.<extension>`, a name that sorts by date. */
export const exportName = (what: string, extension: 'csv' | 'json'): string =>
  `${what}-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.${extension}`;
