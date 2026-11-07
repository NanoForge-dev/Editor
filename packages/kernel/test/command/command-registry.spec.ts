import { describe, expect, it, vi } from 'vitest';

import { CommandNotFoundError } from '../../src/command/command-not-found.exception';
import { CommandPreconditionError } from '../../src/command/command-precondition.exception';
import { CommandRegistry } from '../../src/command/command-registry';
import { ContextKeyService } from '../../src/context/context-key-service';
import { Container } from '../../src/di/container';
import { createToken } from '../../src/di/service-token';

const Counter = createToken<{ value: number }>('counter');

const setup = () => {
  const services = new Container();
  services.provide(Counter, { value: 0 });
  const context = new ContextKeyService();
  return { services, context, commands: new CommandRegistry(services, context) };
};

describe('CommandRegistry', () => {
  it('runs handlers with services and args', async () => {
    const { commands } = setup();
    commands.register({
      id: 'counter.add',
      handler: (s, n: number) => (s.get(Counter).value += n),
    });
    await expect(commands.execute('counter.add', 2)).resolves.toBe(2);
  });

  it('rejects duplicates and unknown commands', async () => {
    const { commands } = setup();
    const sub = commands.register({ id: 'a', handler: () => undefined });
    expect(() => commands.register({ id: 'a', handler: () => undefined })).toThrow();
    sub.dispose();
    await expect(commands.execute('a')).rejects.toThrow(CommandNotFoundError);
  });

  it('checks preconditions', async () => {
    const { commands, context } = setup();
    commands.register({ id: 'runtime.pause', when: 'playing', handler: () => 'paused' });
    expect(commands.isEnabled('runtime.pause')).toBe(false);
    await expect(commands.execute('runtime.pause')).rejects.toThrow(CommandPreconditionError);
    context.set('playing', true);
    await expect(commands.execute('runtime.pause')).resolves.toBe('paused');
  });

  it('activates lazily and reports executions', async () => {
    const { commands } = setup();
    const executions = vi.fn();
    commands.onDidExecute(executions);
    commands.setActivator(async (id) => {
      commands.register({ id, handler: () => 'late' });
    });
    await expect(commands.execute('plugin.cmd')).resolves.toBe('late');
    commands.register({
      id: 'fails',
      handler: () => {
        throw new Error('x');
      },
    });
    await expect(commands.execute('fails')).rejects.toThrow('x');
    expect(executions.mock.calls.map(([e]) => [e.id, 'error' in e])).toEqual([
      ['plugin.cmd', false],
      ['fails', true],
    ]);
  });
});
