import { describe, expect, it } from 'vitest';

import { docsPage } from '../../../src/workbench/tip/docs-url.const';

describe('docsPage', () => {
  it("resolves a page under the editor's folder of the docs site", () => {
    expect(docsPage('editor/entities')).toBe(
      'https://docs.nanoforge.eu/docs/editor/editor/entities',
    );
  });
});
