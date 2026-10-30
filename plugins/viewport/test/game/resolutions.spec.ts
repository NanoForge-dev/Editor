import { describe, expect, it } from 'vitest';

import { frameSize, stepZoom } from '../../src/game/resolutions';

describe('frameSize', () => {
  it('fills the screen, or takes a preset or a custom size times the zoom', () => {
    expect(frameSize('fit', 'landscape', 1)).toBeUndefined();
    expect(frameSize('720p', 'landscape', 0.5)).toEqual({ width: 640, height: 360 });
    expect(frameSize('800x600', 'portrait', 2)).toEqual({ width: 1600, height: 1200 });
    expect(frameSize('8x6', 'landscape', 1)).toBeUndefined();
    expect(frameSize('nonsense', 'landscape', 1)).toBeUndefined();
  });

  it('turns devices in portrait, not screens', () => {
    expect(frameSize('phone', 'portrait', 1)).toEqual({ width: 390, height: 844 });
    expect(frameSize('phone', 'landscape', 1)).toEqual({ width: 844, height: 390 });
    expect(frameSize('1080p', 'portrait', 1)).toEqual({ width: 1920, height: 1080 });
  });
});

describe('stepZoom', () => {
  it('moves one step, stopping at the ends', () => {
    expect(stepZoom(1, 1, false)).toBe(1.5);
    expect(stepZoom(1, -1, false)).toBe(0.75);
    expect(stepZoom(0.25, -1, false)).toBe(0.25);
    expect(stepZoom(4, 1, false)).toBe(4);
    expect(stepZoom(1.2, 1, false)).toBe(2);
  });

  it('keeps to whole zooms when pixel perfect', () => {
    expect(stepZoom(1, 1, true)).toBe(2);
    expect(stepZoom(0.5, 1, true)).toBe(2);
    expect(stepZoom(3, -1, true)).toBe(2);
  });
});
