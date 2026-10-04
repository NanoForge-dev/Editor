import { describe, expect, it, vi } from 'vitest';

import { ContextKeyService } from '../../src/context/context-key-service';

describe('ContextKeyService', () => {
  it('scopes shadow their parent', () => {
    const global = new ContextKeyService();
    global.set('screen', 'scene');
    const widget = global.createScoped('widget');
    widget.set('focus', 'hierarchy');
    expect(widget.evaluate("screen == scene && focus == 'hierarchy'")).toBe(true);
    expect(global.evaluate('focus')).toBe(false);
    widget.set('screen', 'game');
    expect(widget.get('screen')).toBe('game');
    expect(global.get('screen')).toBe('scene');
  });

  it('bind restores the previous value', () => {
    const context = new ContextKeyService();
    context.set('mode', 'edit');
    const binding = context.bind('mode', 'play');
    expect(context.get('mode')).toBe('play');
    binding.dispose();
    expect(context.get('mode')).toBe('edit');
    const temp = context.bind('tmp', 1);
    temp.dispose();
    expect(context.get('tmp')).toBeUndefined();
  });

  it('observe re-evaluates only on relevant keys', () => {
    const global = new ContextKeyService();
    const scoped = global.createScoped('s');
    const run = vi.fn();
    scoped.observe('playing && !paused').subscribe(run);
    global.set('playing', true);
    global.set('unrelated', 1);
    scoped.set('paused', true);
    global.set('paused', false); // shadowed by the scope: no change
    expect(run.mock.calls).toEqual([[false], [true], [false]]);
  });

  it('undefined when clauses are always true', () => {
    const context = new ContextKeyService();
    expect(context.evaluate(undefined)).toBe(true);
    expect(context.observe(undefined).get()).toBe(true);
  });
});
