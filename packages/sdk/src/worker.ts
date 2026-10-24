/**
 * API of plugin worker entries (`entry.worker` in the manifest), running in the code worker.
 * At runtime this module and `ts-morph` are provided by the editor's worker.
 *
 * ```ts
 * import { defineWorkerPlugin } from '@nanoforge-dev/editor-sdk/worker';
 *
 * export default defineWorkerPlugin({
 *   activate(sdk) {
 *     sdk.registerAnalyzer('acme.components', ({ file, literals }) => …);
 *   },
 * });
 * ```
 */
import type { WorkerPluginModule } from '@nanoforge-dev/editor-code/engine';

export {
  type AnalyzeContext,
  type Analyzer,
  type CodeDiagnostic,
  CodeError,
  EditBuilder,
  type LiteralValue,
  type NodeRef,
  type PrintOptions,
  type TextEdit,
  type TransformContext,
  type Transformer,
  type WorkerPluginModule,
  type WorkerSdk,
  literalToValue,
  quoteStyle,
  readExportedLiteral,
  valueToLiteral,
} from '@nanoforge-dev/editor-code/engine';

export {
  type Doc,
  type DocTag,
  type ItemDeclaration,
  type ItemMeta,
  type ItemOwner,
  type ItemRef,
  type OwnerContext,
  type OwnerInput,
  docOf,
  firstTag,
  hasTag,
  leadingDocComments,
  parseDocComment,
  tagTexts,
} from '@nanoforge-dev/editor-meta';

export const defineWorkerPlugin = (plugin: WorkerPluginModule): WorkerPluginModule => plugin;
