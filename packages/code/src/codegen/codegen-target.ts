import type { HistoryCommand } from '@nanoforge-dev/editor-history';
import {
  type ExtensionRegistry,
  type Observable,
  defineExtensionPoint,
} from '@nanoforge-dev/editor-kernel';
import type { AppModel } from '@nanoforge-dev/editor-protocol';

/**
 * Where the editor reads and writes what a visual editor shows (entities, scenes…) as code.
 * Core defines the point only: the ECS plugin provides the default "entry file" target and a
 * scene plugin can take over with a higher priority.
 */
export interface CodegenTarget<Model = unknown, Op = unknown> {
  readonly id: string;
  readonly label: string;
  /** Highest wins when several targets apply to an app. */
  readonly priority?: number;
  appliesTo(app: AppModel): boolean;
  /** Live model of the app, re-read when its files change. */
  load(app: AppModel): Observable<Model | undefined>;
  /** An undoable command performing the operation (code edits through the DocumentService). */
  apply(app: AppModel, op: Op): Promise<HistoryCommand>;
}

export const CODEGEN_TARGETS = defineExtensionPoint<CodegenTarget>('code.codegenTargets');

/** The target used for an app, if any provider applies. */
export const selectTarget = (
  extensions: ExtensionRegistry,
  app: AppModel,
): CodegenTarget | undefined =>
  extensions
    .getValues(CODEGEN_TARGETS)
    .filter((target) => target.appliesTo(app))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
