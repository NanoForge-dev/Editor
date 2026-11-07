import type { EntryScope } from './ecs-model.type';

/** How a scope is named in messages: `main`, `Level1.setup`. */
export const scopeName = (scope: EntryScope | undefined): string =>
  scope?.kind === 'method' ? `${scope.class}.${scope.method}` : 'main';
