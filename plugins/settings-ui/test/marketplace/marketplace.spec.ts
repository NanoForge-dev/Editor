import { describe, expect, it } from 'vitest';

import {
  type PendingChange,
  compactCount,
  installedCopy,
  marketAction,
  missingAccountPlugins,
  withAccountPlugin,
  withoutAccountPlugins,
} from '../../src/marketplace/marketplace';

const plugins = [
  { name: '@nanoforge/git', version: '0.1.0', source: 'bundled' },
  { name: '@acme/tools', version: '1.0.0', source: 'installed' },
  { name: '@acme/both', version: '1.0.0', source: 'installed' },
  { name: '@acme/both', version: '1.1.0', source: 'project' },
  { name: '@acme/hello', version: '0.0.1', source: 'dev' },
];
const none = new Map<string, PendingChange>();

describe('marketplace', () => {
  it('finds the copy of a plugin to speak of', () => {
    expect(installedCopy('@acme/none', plugins, none)).toBeUndefined();
    expect(installedCopy('@acme/tools', plugins, none)).toEqual({
      version: '1.0.0',
      scope: 'user',
    });
    expect(installedCopy('@acme/both', plugins, none)).toEqual({
      version: '1.1.0',
      scope: 'project',
    });
    expect(installedCopy('@nanoforge/git', plugins, none)).toEqual({ version: '0.1.0' });
    const pending = new Map<string, PendingChange>([
      ['@acme/tools', 'removed'],
      ['@acme/new', { version: '2.0.0', scope: 'user' }],
    ]);
    expect(installedCopy('@acme/tools', plugins, pending)).toBeUndefined();
    expect(installedCopy('@acme/new', plugins, pending)).toEqual({
      version: '2.0.0',
      scope: 'user',
    });
  });

  it('offers install, update, or nothing', () => {
    expect(marketAction(undefined, '1.0.0')).toBe('install');
    expect(marketAction(undefined, undefined)).toBe('unsupported');
    expect(marketAction({ version: '1.0.0', scope: 'user' }, '1.0.0')).toBe('installed');
    expect(marketAction({ version: '1.0.0', scope: 'user' }, '1.2.0')).toBe('update');
    expect(marketAction({ version: '1.0.0', scope: 'user' }, undefined)).toBe('installed');
    expect(marketAction({ version: '0.1.0' }, '9.0.0')).toBe('builtin');
  });

  it('keeps the list of plugins installed for me, and finds the ones missing here', () => {
    const list = withAccountPlugin({ '@b/two': '^1.0.0' }, '@a/one', '2.1.0');
    expect(Object.entries(list)).toEqual([
      ['@a/one', '^2.1.0'],
      ['@b/two', '^1.0.0'],
    ]);
    expect(withoutAccountPlugins(list, ['@b/two'])).toEqual({ '@a/one': '^2.1.0' });
    expect(missingAccountPlugins({ '@acme/hello': '*', '@acme/gone': '*' }, plugins)).toEqual([
      '@acme/gone',
    ]);
  });

  it('shortens download counts', () => {
    expect([12, 1000, 1250, 3_400_000].map(compactCount)).toEqual(['12', '1k', '1.3k', '3.4M']);
  });
});
