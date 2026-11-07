import { describe, expect, it } from 'vitest';

import { checkCompatibility } from '../../src/compatibility/check-compatibility';

describe('checkCompatibility', () => {
  it('tells legacy, older and newer engines apart', () => {
    expect(checkCompatibility('client', 'c', { protocolVersion: 2 }, 2).status).toBe('ok');
    expect(checkCompatibility('client', 'c', undefined, 2)).toMatchObject({
      status: 'legacy',
      message: expect.stringContaining('app.use(new EditorLibrary())'),
    });
    expect(checkCompatibility('server', 's', { protocolVersion: 1 }, 2)).toMatchObject({
      status: 'older',
      message: expect.stringContaining('Update the NanoForge engine'),
    });
    expect(checkCompatibility('server', 's', { protocolVersion: 3 }, 2)).toMatchObject({
      status: 'newer',
      message: expect.stringContaining('update the NanoForge editor'),
    });
  });
});
