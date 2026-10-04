import { afterEach, describe, expect, it } from 'vitest';

import { ExtensionRegistry, ObservableValue } from '@nanoforge-dev/editor-kernel';

import { StyleService } from '../src/style/style-service';
import { ThemeService } from '../src/theme/theme-service';

const element = (html: string) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host;
};

afterEach(() => {
  document.body.innerHTML = '';
  document.adoptedStyleSheets = [];
});

describe('StyleService', () => {
  it('scopes widget styles and removes them on dispose', () => {
    const styles = new StyleService();
    const host = element(`
      <section data-nf-widget="acme.hierarchy"><p class="label">in</p></section>
      <section data-nf-widget="other"><p class="label">out</p></section>`);
    const [inside, outside] = host.querySelectorAll('p');
    const sheet = styles.inject('@acme/tools', '.label { color: rgb(255, 0, 0); }', {
      widgetId: 'acme.hierarchy',
    });
    expect(getComputedStyle(inside!).color).toBe('rgb(255, 0, 0)');
    expect(getComputedStyle(outside!).color).not.toBe('rgb(255, 0, 0)');
    sheet.dispose();
    expect(getComputedStyle(inside!).color).not.toBe('rgb(255, 0, 0)');
  });

  it('orders layers: user overrides beat plugins, plugins beat ui', () => {
    const styles = new StyleService();
    const host = element('<p class="x">x</p>');
    const p = host.querySelector('p')!;
    styles.inject('user', '.x { color: rgb(0, 0, 255); }', { layer: 'user' });
    styles.inject('@acme/tools', 'p.x { color: rgb(0, 255, 0); }');
    styles.inject('core', 'body p.x { color: rgb(255, 0, 0); }');
    expect(getComputedStyle(p).color).toBe('rgb(0, 0, 255)');
  });
});

describe('ThemeService', () => {
  it('applies the selected theme and follows the setting', () => {
    const styles = new StyleService();
    const selected = new ObservableValue('nanoforge-dark');
    const themes = new ThemeService(new ExtensionRegistry(), styles, selected);
    const root = document.documentElement;
    expect(root.dataset.nfTheme).toBe('nanoforge-dark');
    expect(getComputedStyle(root).getPropertyValue('--nf-color-surface').trim()).toBe('#1a1f28');
    selected.set('nanoforge-light');
    expect(getComputedStyle(root).getPropertyValue('--nf-color-surface').trim()).toBe('#eef1f5');
    selected.set('missing-theme');
    expect(root.dataset.nfTheme).toBe('nanoforge-dark');
    themes.dispose();
  });
});
