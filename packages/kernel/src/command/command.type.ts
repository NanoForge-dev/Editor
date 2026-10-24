import type { ServiceAccessor } from '../di/container.type';

export type CommandHandler<A extends unknown[] = unknown[], R = unknown> = (
  accessor: ServiceAccessor,
  ...args: A
) => R | Promise<R>;

export interface CommandMetadata {
  /** Human readable title (already localized, or a localization key resolved by the UI). */
  title?: string;
  category?: string;
  icon?: string;
  /** Precondition: the command can only run when this clause is true. */
  when?: string;
  /**
   * `false` keeps the command out of the command palette and the keymap editor: it needs
   * arguments (menu entries that give them are listed instead).
   */
  palette?: boolean;
}

export interface CommandDescriptor<
  A extends unknown[] = unknown[],
  R = unknown,
> extends CommandMetadata {
  id: string;
  handler: CommandHandler<A, R>;
  /** Plugin name or `core`. */
  owner?: string;
}

export interface CommandExecution {
  readonly id: string;
  readonly args: readonly unknown[];
  readonly durationMs: number;
  readonly error?: unknown;
}

/** Resolves a lazily activated command (plugin activation on `onCommand:<id>`). */
export type CommandActivator = (id: string) => Promise<void>;
