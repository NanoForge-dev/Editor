import type { ContextKeyService } from '../context/context-key-service';
import { parseWhen } from '../context/parse-when';
import type { ServiceAccessor } from '../di/container.type';
import { Emitter, type Event } from '../event/emitter';
import { type Disposable, toDisposable } from '../lifecycle/disposable';
import { CommandNotFoundError } from './command-not-found.exception';
import { CommandPreconditionError } from './command-precondition.exception';
import type { CommandActivator, CommandDescriptor, CommandExecution } from './command.type';

export class CommandRegistry implements Disposable {
  private readonly _commands = new Map<string, CommandDescriptor>();
  private readonly _onDidRegister = new Emitter<string>();
  private readonly _onDidExecute = new Emitter<CommandExecution>();
  private _activator: CommandActivator | undefined;

  readonly onDidRegister: Event<string> = this._onDidRegister.event;
  readonly onDidExecute: Event<CommandExecution> = this._onDidExecute.event;

  constructor(
    private readonly _services: ServiceAccessor,
    private readonly _context?: ContextKeyService,
  ) {}

  /** Hook called before running an unknown command, so its plugin can activate. */
  setActivator(activator: CommandActivator | undefined): void {
    this._activator = activator;
  }

  register<A extends unknown[], R>(descriptor: CommandDescriptor<A, R>): Disposable {
    if (this._commands.has(descriptor.id)) {
      throw new Error(`Command "${descriptor.id}" is already registered`);
    }
    if (descriptor.when) parseWhen(descriptor.when); // fail fast on invalid clauses
    this._commands.set(descriptor.id, descriptor as unknown as CommandDescriptor);
    this._onDidRegister.fire(descriptor.id);
    return toDisposable(() => {
      if (this._commands.get(descriptor.id) === (descriptor as unknown)) {
        this._commands.delete(descriptor.id);
      }
    });
  }

  has(id: string): boolean {
    return this._commands.has(id);
  }

  get(id: string): CommandDescriptor | undefined {
    return this._commands.get(id);
  }

  getAll(): CommandDescriptor[] {
    return [...this._commands.values()];
  }

  isEnabled(id: string): boolean {
    const command = this._commands.get(id);
    return !!command && (this._context?.evaluate(command.when) ?? true);
  }

  async execute<R = unknown>(id: string, ...args: unknown[]): Promise<R> {
    if (!this._commands.has(id) && this._activator) await this._activator(id);
    const command = this._commands.get(id);
    if (!command) throw new CommandNotFoundError(id);
    if (command.when && this._context && !this._context.evaluate(command.when)) {
      throw new CommandPreconditionError(id, command.when);
    }
    const start = performance.now();
    try {
      const result = (await command.handler(this._services, ...args)) as R;
      this._onDidExecute.fire({ id, args, durationMs: performance.now() - start });
      return result;
    } catch (error) {
      this._onDidExecute.fire({ id, args, durationMs: performance.now() - start, error });
      throw error;
    }
  }

  dispose(): void {
    this._commands.clear();
    this._onDidRegister.dispose();
    this._onDidExecute.dispose();
  }
}
