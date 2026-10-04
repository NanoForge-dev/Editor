import { describe, expect, it, vi } from 'vitest';

import { Container } from '../../src/di/container';
import { CyclicDependencyError } from '../../src/di/cyclic-dependency.exception';
import { ServiceNotFoundError } from '../../src/di/service-not-found.exception';
import { createToken } from '../../src/di/service-token';
import { toDisposable } from '../../src/lifecycle/disposable';

interface Greeter {
  greet(): string;
}
const Greeter = createToken<Greeter>('greeter');
const Name = createToken<string>('name');

describe('Container', () => {
  it('resolves values and lazy factories once', () => {
    const container = new Container();
    const factory = vi.fn(() => ({ greet: () => 'hi' }));
    container.provideFactory(Greeter, factory);
    expect(factory).not.toHaveBeenCalled();
    expect(container.get(Greeter)).toBe(container.get(Greeter));
    expect(factory).toHaveBeenCalledOnce();
    expect(() => container.get(Name)).toThrow(ServiceNotFoundError);
    expect(container.tryGet(Name)).toBeUndefined();
  });

  it('picks the highest priority, then the latest registration', () => {
    const container = new Container();
    container.provide(Name, 'default');
    const high = container.provide(Name, 'plugin', { priority: 10 });
    container.provide(Name, 'late');
    expect(container.get(Name)).toBe('plugin');
    high.dispose();
    expect(container.get(Name)).toBe('late');
    expect(container.getAll(Name)).toEqual(['default', 'late']);
  });

  it('applies overrides from the root down to the requesting scope', () => {
    const root = new Container();
    root.provide(Name, 'base');
    root.override(Name, (inner) => `${inner}+root`);
    const child = root.createChild('project');
    child.override(Name, (inner) => `${inner}+child`, { priority: 5 });
    root.override(Name, (inner) => `${inner}+root2`, { priority: 1 });
    expect(root.get(Name)).toBe('base+root+root2');
    expect(child.get(Name)).toBe('base+root+root2+child');
  });

  it('children shadow their parent and see parent changes', () => {
    const root = new Container();
    root.provide(Name, 'root');
    const child = root.createChild('child');
    expect(child.get(Name)).toBe('root');
    root.provide(Name, 'root2');
    expect(child.get(Name)).toBe('root2');
    const local = child.provide(Name, 'child');
    expect(child.get(Name)).toBe('child');
    expect(root.get(Name)).toBe('root2');
    local.dispose();
    expect(child.get(Name)).toBe('root2');
  });

  it('factories resolve dependencies through their owner', () => {
    const root = new Container();
    root.provide(Name, 'world');
    root.provideFactory(Greeter, (s) => ({ greet: () => `hello ${s.get(Name)}` }));
    const child = root.createChild('c');
    child.provide(Name, 'child'); // does not affect the root singleton
    expect(child.get(Greeter).greet()).toBe('hello world');
  });

  it('detects cycles', () => {
    const A = createToken<number>('a');
    const B = createToken<number>('b');
    const container = new Container();
    container.provideFactory(A, (s) => s.get(B) + 1);
    container.provideFactory(B, (s) => s.get(A) + 1);
    expect(() => container.get(A)).toThrow(CyclicDependencyError);
    expect(() => container.get(A)).toThrow('a -> b -> a');
  });

  it('observe follows provider changes', () => {
    const container = new Container();
    const run = vi.fn();
    container.observe(Name).subscribe(run);
    const provider = container.provide(Name, 'a');
    container.provide(Greeter, { greet: () => '' });
    provider.dispose();
    expect(run.mock.calls).toEqual([[undefined], ['a'], [undefined]]);
  });

  it('disposes factory instances, children, and refuses use after dispose', () => {
    const root = new Container();
    const disposed = vi.fn();
    const Service = createToken<{ dispose(): void }>('svc');
    root.provideFactory(Service, () => toDisposable(disposed));
    const child = root.createChild('child');
    root.get(Service);
    root.dispose();
    expect(disposed).toHaveBeenCalledOnce();
    expect(() => child.get(Name)).toThrow(/disposed/);
  });

  it('disposes the instance when its provider is removed', () => {
    const container = new Container();
    const disposed = vi.fn();
    const Service = createToken<{ dispose(): void }>('svc');
    const provider = container.provideFactory(Service, () => toDisposable(disposed));
    container.get(Service);
    provider.dispose();
    expect(disposed).toHaveBeenCalledOnce();
  });
});
