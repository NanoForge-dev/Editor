import { describe, expect, it } from 'vitest';

import { ContextKeyService } from '@nanoforge-dev/editor-kernel';
import { TourSchema } from '@nanoforge-dev/editor-ui/tour';

import { TUTORIAL_TOUR } from '../../src/lib/tutorial/tutorial-tour.const';

/** The steps an editor shows, its keys as given. */
const steps = (keys: Record<string, unknown>) => {
  const context = new ContextKeyService();
  for (const [key, value] of Object.entries(keys)) context.set(key, value);
  return TourSchema.parse(TUTORIAL_TOUR)
    .steps.filter((step) => context.evaluate(step.when))
    .map((step) => step.id);
};

describe('the tutorial tour', () => {
  it('walks a local editor through its own project, the bridge decides World, git decides Commit', () => {
    const local = { 'editor.local': true, 'git.repository': false, 'runtime.active': true };
    expect(steps({ ...local, 'runtime.controllable': true })).toEqual([
      'welcome',
      'screens',
      'scene',
      'add-entity',
      'select-ball',
      'change-value',
      'fix',
      'play',
      'world',
      'init',
      'done',
    ]);
    const repository = steps({ ...local, 'git.repository': true, 'runtime.controllable': true });
    expect(repository).toContain('commit');
    expect(repository).not.toContain('init');
    expect(steps({ ...local, 'runtime.controllable': false })).toContain('no-bridge');
    expect(steps({ ...local, 'runtime.controllable': false })).not.toContain('world');
  });

  it('gives a hosted editor only what works on any project', () => {
    expect(steps({ 'editor.local': false })).toEqual([
      'welcome-hosted',
      'screens',
      'scene',
      'add-entity',
      'select-hosted',
      'change-value-hosted',
      'code-hosted',
      'done',
    ]);
  });
});
