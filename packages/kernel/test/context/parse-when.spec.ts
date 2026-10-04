import { describe, expect, it } from 'vitest';

import { parseWhen } from '../../src/context/parse-when';
import { WhenParseError } from '../../src/context/when-parse.exception';

const ctx: Record<string, unknown> = {
  editorFocus: true,
  screen: 'scene',
  count: 2,
  'engineLib:@nanoforge-dev/ecs': true,
  'plugin.@nanoforge/ecs.eligible': false,
  resourceName: 'player.component.ts',
  selection: 'entity',
  selectable: ['entity', 'component'],
  apps: { client: {}, server: {} },
  app: 'server',
};
const run = (source: string) => parseWhen(source).evaluate((key) => ctx[key]);

describe('when clauses', () => {
  it.each([
    ['editorFocus', true],
    ['!editorFocus', false],
    ['missing', false],
    ['true && !false', true],
    ["screen == 'scene'", true],
    ['screen == scene', true],
    ['screen != "game"', true],
    ['count == 2', true],
    ['count == 3', false],
    ['engineLib:@nanoforge-dev/ecs && !plugin.@nanoforge/ecs.eligible', true],
    ['resourceName =~ /\\.component\\.ts$/', true],
    ['resourceName =~ /\\.SYSTEM\\.ts$/i', false],
    ['selection in selectable', true],
    ['app in apps', true],
    ['screen == game || (editorFocus && count == 2)', true],
    ['!(editorFocus || missing)', false],
  ])('%s → %s', (source, expected) => {
    expect(run(source)).toBe(expected);
  });

  it('reports read keys', () => {
    expect([...parseWhen('a && (b == x || !c) && d in e').keys]).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it.each(['a &&', '(a', 'a == ', "a == 'x", 'a =~ b', 'a b', '#'])('rejects %s', (source) => {
    expect(() => parseWhen(source)).toThrow(WhenParseError);
  });
});
