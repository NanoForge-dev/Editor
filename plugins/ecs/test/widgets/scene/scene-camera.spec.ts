import { describe, expect, it } from 'vitest';

import { FIT, isFitted, zoomAround, zoomOf } from '../../../src/widgets/scene/scene-camera';

describe('scene camera', () => {
  it('starts fitted at zoom 1', () => {
    expect(isFitted({ ...FIT })).toBe(true);
    expect(zoomOf(FIT)).toBe(1);
  });

  it('zooms in around the point, keeping it in place', () => {
    const point = { x: 400, y: 300 };
    const view = zoomAround(FIT, point, -1);
    expect(zoomOf(view)).toBeCloseTo(1.15);
    expect((point.x - view.x) / view.width).toBeCloseTo((point.x - FIT.x) / FIT.width);
    expect(isFitted(view)).toBe(false);
  });

  it('stops at the zoom limits', () => {
    let view = FIT;
    for (let i = 0; i < 100; i += 1) view = zoomAround(view, { x: 0, y: 0 }, 1);
    expect(zoomOf(view)).toBeCloseTo(0.1);
  });
});
