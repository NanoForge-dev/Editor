/** A round number at or above a value, for the top of an axis: 1, 2, 5, 10, 20, 50… */
export const niceMax = (value: number): number => {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const scaled = value / power;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * power;
};

/** SVG path of a line through values spread evenly over a width (y grows down). */
export const linePath = (
  values: readonly number[],
  width: number,
  height: number,
  max: number,
  slots = values.length,
): string => {
  if (!values.length) return '';
  const step = slots > 1 ? width / (slots - 1) : 0;
  const offset = (slots - values.length) * step;
  return values
    .map((value, index) => {
      const x = offset + index * step;
      const y = height - (Math.min(Math.max(value, 0), max) / max) * height;
      return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join('');
};

/** Index of the value under an x position, or undefined outside of the data. */
export const indexAt = (
  x: number,
  width: number,
  count: number,
  slots = count,
): number | undefined => {
  if (!count || width <= 0) return undefined;
  const step = slots > 1 ? width / (slots - 1) : width;
  const index = Math.round(x / step) - (slots - count);
  return index < 0 || index >= count ? undefined : index;
};
