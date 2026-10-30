import { describe, expect, it } from 'vitest';

import { CoreServices, createCoreContainer } from '@nanoforge-dev/editor-kernel';

import { TourService } from '../../../src/workbench/tour/tour-service';
import { TOURS, type Tour } from '../../../src/workbench/tour/tour.extension-point';

const setup = (tour: Tour) => {
  const container = createCoreContainer();
  const extensions = container.get(CoreServices.Extensions);
  const contextKeys = container.get(CoreServices.ContextKeys);
  extensions.contribute(TOURS, tour, { owner: 'test' });
  const tours = new TourService(extensions, contextKeys, container.get(CoreServices.Commands));
  const title = () => tours.state.get()?.step.title;
  const settle = () => new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
  return { tours, contextKeys, title, settle };
};

const step = (id: string, extra: object = {}) => ({ id, title: id, text: `About ${id}`, ...extra });

describe('TourService', () => {
  it('goes forward and back, skips steps that do not apply, and ends after the last', () => {
    const { tours, contextKeys, title } = setup({
      id: 'demo',
      title: 'Demo',
      steps: [step('one'), step('local', { when: 'editor.local' }), step('two')],
    });
    expect(tours.start('demo')).toBe(true);
    expect(tours.state.get()).toMatchObject({ position: 1, count: 2 });
    tours.next();
    expect(title()).toBe('two');
    tours.back();
    expect(title()).toBe('one');
    contextKeys.set('editor.local', true);
    tours.next();
    expect(title()).toBe('local');
    tours.next();
    tours.next();
    expect(tours.state.get()).toBeUndefined();
    expect(tours.start('nope')).toBe(false);
  });

  it('goes on by itself when the step condition is met or its key changes', async () => {
    const { tours, contextKeys, title, settle } = setup({
      id: 'demo',
      title: 'Demo',
      steps: [
        step('play', { advanceWhen: "runtime.state == 'running'" }),
        step('add', { advanceWhenChanged: 'ecs.entityCount' }),
        step('end'),
      ],
    });
    contextKeys.set('ecs.entityCount', 3);
    tours.start('demo');
    contextKeys.set('runtime.state', 'running');
    await settle();
    expect(title()).toBe('add');
    contextKeys.set('ecs.entityCount', 3);
    await settle();
    expect(title()).toBe('add');
    contextKeys.set('ecs.entityCount', 4);
    await settle();
    expect(title()).toBe('end');
  });

  it('waits for a key that is not set yet instead of taking its first value as a change', async () => {
    const { tours, contextKeys, title, settle } = setup({
      id: 'demo',
      title: 'Demo',
      steps: [step('commit', { advanceWhenChanged: 'git.head' }), step('end')],
    });
    tours.start('demo');
    contextKeys.set('git.head', 'abc');
    await settle();
    expect(title()).toBe('commit');
    contextKeys.set('git.head', 'def');
    await settle();
    expect(title()).toBe('end');
  });

  it('keeps the count of the steps that applied at the start', () => {
    const { tours, contextKeys } = setup({
      id: 'demo',
      title: 'Demo',
      steps: [step('init', { when: '!git.repository' }), step('commit'), step('end')],
    });
    tours.start('demo');
    expect(tours.state.get()).toMatchObject({ position: 1, count: 3 });
    contextKeys.set('git.repository', true);
    tours.next();
    expect(tours.state.get()).toMatchObject({ position: 2, count: 3 });
  });
});
