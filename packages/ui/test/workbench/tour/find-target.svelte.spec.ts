import { afterEach, describe, expect, it } from 'vitest';

import { findTarget } from '../../../src/workbench/tour/find-target';

afterEach(() => document.body.replaceChildren());

describe('findTarget', () => {
  it('finds elements by role and accessible name, as the e2e tests do', () => {
    document.body.innerHTML = `
      <nav aria-label="Left tool windows"><div role="tab" aria-label="Files">F</div></nav>
      <section aria-label="Hierarchy"><button>Add entity</button></section>
      <section aria-label="Systems"><button>Add entity</button></section>
      <span id="label">Search files</span><input aria-labelledby="label" />
      <button hidden>Play</button>
    `;
    expect(findTarget({ role: 'tab', name: 'Files' })?.textContent).toBe('F');
    const hierarchy = findTarget({
      role: 'button',
      name: 'Add entity',
      within: { role: 'region', name: 'Hierarchy' },
    });
    expect(hierarchy?.closest('section')?.getAttribute('aria-label')).toBe('Hierarchy');
    expect(findTarget({ role: 'textbox', name: 'Search files' })?.tagName).toBe('INPUT');
    expect(findTarget({ role: 'button', name: 'Play' })).toBeUndefined();
    expect(findTarget({ role: 'button', name: 'Nothing' })).toBeUndefined();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div role="treeitem">ball Position2D</div><div role="treeitem">balloon</div>',
    );
    expect(findTarget({ role: 'treeitem', name: 'ball' })).toBeUndefined();
    expect(findTarget({ role: 'treeitem', name: 'ball', exact: false })?.textContent).toBe(
      'ball Position2D',
    );
    expect(findTarget({ role: 'treeitem', name: 'balloon', exact: false })?.textContent).toBe(
      'balloon',
    );
  });
});
