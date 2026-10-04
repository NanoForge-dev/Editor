export interface Resolution {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  /** Devices can be turned (portrait/landscape). */
  readonly device?: boolean;
}

export const RESOLUTIONS: readonly Resolution[] = [
  { id: '1080p', label: '1920 × 1080 (16:9)', width: 1920, height: 1080 },
  { id: '720p', label: '1280 × 720 (16:9)', width: 1280, height: 720 },
  { id: '4:3', label: '1024 × 768 (4:3)', width: 1024, height: 768 },
  { id: 'phone', label: 'Phone (390 × 844)', width: 844, height: 390, device: true },
  { id: 'tablet', label: 'Tablet (820 × 1180)', width: 1180, height: 820, device: true },
];

export const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;

/**
 * Size of the game container: undefined to fill the screen (`fit`), else the preset or custom
 * `WxH`, turned for devices in portrait, times the zoom.
 */
export const frameSize = (
  resolution: string,
  orientation: 'landscape' | 'portrait',
  zoom: number,
): { width: number; height: number } | undefined => {
  if (resolution === 'fit') return undefined;
  const preset = RESOLUTIONS.find((candidate) => candidate.id === resolution);
  const custom = /^(\d{2,5})x(\d{2,5})$/.exec(resolution);
  let width = preset?.width ?? Number(custom?.[1] ?? 0);
  let height = preset?.height ?? Number(custom?.[2] ?? 0);
  if (!width || !height) return undefined;
  if (preset?.device && orientation === 'portrait') [width, height] = [height, width];
  return { width: Math.round(width * zoom), height: Math.round(height * zoom) };
};

/** Next zoom step (pixel perfect: integers only). */
export const stepZoom = (zoom: number, direction: 1 | -1, pixelPerfect: boolean): number => {
  const steps = pixelPerfect ? ZOOMS.filter((value) => Number.isInteger(value)) : ZOOMS;
  const index = steps.findIndex((value) => value >= zoom - 1e-9);
  const current = index < 0 ? steps.length - 1 : index;
  return steps[Math.min(steps.length - 1, Math.max(0, current + direction))]!;
};
