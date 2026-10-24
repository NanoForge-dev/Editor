import { describe, expect, it, vi } from 'vitest';

import { LocalizationService } from '../../src/i18n/localization-service';
import { formatMessage } from '../../src/i18n/message-format';

describe('formatMessage', () => {
  it.each([
    ['Hello {name}', { name: 'Ada' }, 'Hello Ada'],
    ['Missing {x}', {}, 'Missing {x}'],
    ['{n, plural, =0 {no entity} one {# entity} other {# entities}}', { n: 0 }, 'no entity'],
    ['{n, plural, one {# entity} other {# entities}}', { n: 1 }, '1 entity'],
    ['{n, plural, one {# entity} other {# entities}}', { n: 1200 }, '1,200 entities'],
    ['{kind, select, client {Client} server {Server} other {Lib}}', { kind: 'server' }, 'Server'],
    ['{kind, select, client {Client} other {Lib {name}}}', { kind: 'x', name: 'core' }, 'Lib core'],
    ["Escaped '{brace}", {}, 'Escaped {brace}'],
  ])('%s', (message, params, expected) => {
    expect(formatMessage(message, params)).toBe(expected);
  });

  it('uses locale plural rules', () => {
    expect(formatMessage('{n, plural, one {# fichier} other {# fichiers}}', { n: 0 }, 'fr')).toBe(
      '0 fichier',
    );
  });
});

describe('LocalizationService', () => {
  it('falls back from region to language to english to key', () => {
    const i18n = new LocalizationService();
    i18n.registerBundle('core', 'en', { save: 'Save', quit: 'Quit' });
    i18n.registerBundle('core', 'fr', { save: 'Enregistrer' });
    const t = i18n.scope('core');
    i18n.setLocale('fr-CA');
    expect(t('save')).toBe('Enregistrer');
    expect(t('quit')).toBe('Quit');
    expect(t('unknown')).toBe('unknown');
    expect(i18n.locales).toEqual(['en', 'fr']);
  });

  it('later bundles override earlier ones until disposed', () => {
    const i18n = new LocalizationService();
    const revision = vi.fn();
    i18n.revision.subscribe(revision);
    i18n.registerBundle('ecs', 'en', { title: 'Entities' });
    const patch = i18n.registerBundle('ecs', 'en', { title: 'Actors' });
    expect(i18n.translate('ecs', 'title')).toBe('Actors');
    patch.dispose();
    expect(i18n.translate('ecs', 'title')).toBe('Entities');
    expect(revision).toHaveBeenCalledTimes(4);
  });
});
