import { afterEach, describe, expect, it } from 'vitest';

import { focusNextPart } from '../../../src/workbench/parts/panel-focus';

const workbench = () => {
  const root = document.createElement('div');
  root.innerHTML = `
    <div data-nf-part="left"><input aria-label="search" /></div>
    <main data-nf-part="screen">
      <section hidden><button>hidden screen</button></section>
      <section><button>shown screen</button></section>
    </main>
    <div data-nf-part="bottom"><p>no controls</p></div>
    <div data-nf-part="right" hidden><button>hidden dock</button></div>`;
  document.body.append(root);
  return root;
};

const active = () => document.activeElement?.textContent || document.activeElement?.ariaLabel;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focusNextPart', () => {
  it('cycles through the visible parts, skipping hidden subtrees', () => {
    const root = workbench();
    root.querySelector('input')!.focus();
    focusNextPart(root, 1);
    expect(active()).toBe('shown screen');
    focusNextPart(root, 1);
    expect(document.activeElement).toBe(root.querySelector('[data-nf-part="bottom"]'));
    focusNextPart(root, 1);
    expect(active()).toBe('search');
    focusNextPart(root, -1);
    expect(document.activeElement).toBe(root.querySelector('[data-nf-part="bottom"]'));
  });

  it('starts at the first or last part when the focus is outside', () => {
    const root = workbench();
    focusNextPart(root, 1);
    expect(active()).toBe('search');
    document.body.focus();
    (document.activeElement as HTMLElement | null)?.blur();
    focusNextPart(root, -1);
    expect(document.activeElement).toBe(root.querySelector('[data-nf-part="bottom"]'));
  });
});
